from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, json, uuid, httpx, tempfile
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- Models ---
class TransactionCreate(BaseModel):
    amount: float
    category: str
    description: str
    date: str
    type: str

class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    type: Optional[str] = None

class IncomeUpdate(BaseModel):
    monthly_income: float

class ChatMessageInput(BaseModel):
    message: str

# --- Auth Helper ---
async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Auth Endpoints ---
@api_router.post("/auth/session")
async def exchange_session(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        auth_data = resp.json()
    existing = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": auth_data["name"], "picture": auth_data["picture"]}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": auth_data["email"],
            "name": auth_data["name"], "picture": auth_data["picture"],
            "monthly_income": 0, "created_at": datetime.now(timezone.utc).isoformat()
        })
    session_token = auth_data.get("session_token", f"session_{uuid.uuid4().hex}")
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        await db.user_sessions.delete_one({"session_token": auth.split(" ")[1]})
    return {"message": "Logged out"}

# --- User ---
@api_router.put("/user/income")
async def update_income(data: IncomeUpdate, user=Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"monthly_income": data.monthly_income}})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

# --- Transactions ---
@api_router.get("/transactions")
async def get_transactions(month: Optional[str] = None, year: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    now = datetime.now(timezone.utc)
    m = month or str(now.month).zfill(2)
    y = year or str(now.year)
    query["date"] = {"$regex": f"^{y}-{m.zfill(2)}"}
    return await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)

@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate, user=Depends(get_current_user)):
    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "amount": data.amount, "category": data.category,
        "description": data.description, "date": data.date,
        "type": data.type, "created_by": "manual",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(txn)
    return await db.transactions.find_one({"transaction_id": txn["transaction_id"]}, {"_id": 0})

@api_router.put("/transactions/{tid}")
async def update_transaction(tid: str, data: TransactionUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No data")
    r = await db.transactions.update_one({"transaction_id": tid, "user_id": user["user_id"]}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.transactions.find_one({"transaction_id": tid}, {"_id": 0})

@api_router.delete("/transactions/{tid}")
async def delete_transaction(tid: str, user=Depends(get_current_user)):
    r = await db.transactions.delete_one({"transaction_id": tid, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# --- Dashboard ---
@api_router.get("/dashboard")
async def get_dashboard(month: Optional[str] = None, year: Optional[str] = None, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    m = (month or str(now.month)).zfill(2)
    y = year or str(now.year)
    prefix = f"{y}-{m}"
    txns = await db.transactions.find({"user_id": user["user_id"], "date": {"$regex": f"^{prefix}"}}, {"_id": 0}).to_list(1000)
    income = sum(t["amount"] for t in txns if t["type"] == "income")
    expense = sum(t["amount"] for t in txns if t["type"] == "expense")
    cats = {}
    for t in txns:
        if t["type"] == "expense":
            cats[t["category"]] = cats.get(t["category"], 0) + t["amount"]
    return {
        "monthly_income": user.get("monthly_income", 0),
        "total_income": income, "total_expense": expense,
        "balance": user.get("monthly_income", 0) + income - expense,
        "category_breakdown": [{"category": k, "amount": v} for k, v in sorted(cats.items(), key=lambda x: -x[1])],
        "recent_transactions": sorted(txns, key=lambda x: x.get("date", ""), reverse=True)[:5],
        "transaction_count": len(txns)
    }

# --- Voice ---
@api_router.post("/voice/transcribe")
async def transcribe_only(audio: UploadFile = File(...), user=Depends(get_current_user)):
    suffix = ".m4a"
    if audio.filename and '.' in audio.filename:
        suffix = f".{audio.filename.rsplit('.', 1)[1]}"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        with open(tmp_path, "rb") as f:
            resp = await stt.transcribe(file=f, model="whisper-1", response_format="json")
        return {"transcript": resp.text}
    finally:
        os.unlink(tmp_path)

@api_router.post("/voice/process")
async def process_voice(audio: UploadFile = File(...), target_date: str = Form(None), user=Depends(get_current_user)):
    suffix = ".m4a"
    if audio.filename and '.' in audio.filename:
        suffix = f".{audio.filename.rsplit('.', 1)[1]}"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        with open(tmp_path, "rb") as f:
            resp = await stt.transcribe(file=f, model="whisper-1", response_format="json")
        transcript = resp.text
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        use_date = target_date or today
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"extract_{uuid.uuid4().hex[:8]}",
            system_message=f"""Extract all financial transactions from the user's speech. Today: {today}. Default date: {use_date}. Currency: INR.
For each transaction: amount (number), category (Food/Transport/Shopping/Entertainment/Bills/Health/Education/Groceries/Rent/Salary/Freelance/Investment/Other), description (brief), date (YYYY-MM-DD, use {use_date} if not specified), type (income/expense).
Return ONLY a JSON array. No other text. Empty array [] if none found."""
        ).with_model("openai", "gpt-5.2")
        ai_resp = await chat.send_message(UserMessage(text=transcript))
        try:
            clean = ai_resp.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
                if clean.endswith("```"): clean = clean[:-3]
                clean = clean.strip()
            extracted = json.loads(clean)
        except Exception:
            extracted = []
        stored = []
        for t in extracted:
            txn = {
                "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "amount": float(t.get("amount", 0)), "category": t.get("category", "Other"),
                "description": t.get("description", ""), "date": t.get("date", use_date),
                "type": t.get("type", "expense"), "created_by": "ai",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.transactions.insert_one(txn)
            stored.append(await db.transactions.find_one({"transaction_id": txn["transaction_id"]}, {"_id": 0}))
        return {"transcript": transcript, "transactions": stored}
    finally:
        os.unlink(tmp_path)

# --- Chat ---
@api_router.post("/chat")
async def chat_jarvis(data: ChatMessageInput, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    m, y = str(now.month).zfill(2), str(now.year)
    prefix = f"{y}-{m}"
    txns = await db.transactions.find({"user_id": user["user_id"], "date": {"$regex": f"^{prefix}"}}, {"_id": 0}).to_list(1000)
    income = sum(t["amount"] for t in txns if t["type"] == "income")
    expense = sum(t["amount"] for t in txns if t["type"] == "expense")
    cats = {}
    for t in txns:
        if t["type"] == "expense":
            cats[t["category"]] = cats.get(t["category"], 0) + t["amount"]
    recent = sorted(txns, key=lambda x: x.get("date", ""), reverse=True)[:10]
    recent_str = "\n".join([f"- {t['date']}: ₹{t['amount']} {t['type']} ({t['category']}: {t['description']})" for t in recent])
    cat_str = "\n".join([f"- {k}: ₹{v}" for k, v in cats.items()])
    system = f"""You are Jarvis, a smart AI financial assistant. Currency: INR (₹). Be concise, friendly, data-driven.

USER: {user.get('name', 'User')}
Monthly Income: ₹{user.get('monthly_income', 0)}
This month income (transactions): ₹{income}
This month expenses: ₹{expense}
Balance: ₹{user.get('monthly_income', 0) + income - expense}

EXPENSES BY CATEGORY:
{cat_str or 'None yet'}

RECENT TRANSACTIONS:
{recent_str or 'None yet'}

If user mentions spending (e.g. "I spent ₹200 on food"), extract it and add at END of response:
```transaction[{{"amount":200,"category":"Food","description":"food","date":"{now.strftime('%Y-%m-%d')}","type":"expense"}}]```
Only add if user mentions a NEW transaction. Today: {now.strftime('%Y-%m-%d')}"""

    history = await db.chat_messages.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    history.reverse()
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"jarvis_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=system
    ).with_model("openai", "gpt-5.2")
    context = ""
    if history:
        for msg in history[-10:]:
            context += f"\n{'User' if msg['role'] == 'user' else 'Jarvis'}: {msg['content']}"
    full_msg = f"[Chat history:{context}]\n\nUser: {data.message}" if context else data.message
    ai_resp = await chat.send_message(UserMessage(text=full_msg))
    new_txns = []
    clean_resp = ai_resp
    if "```transaction" in ai_resp:
        try:
            txn_str = ai_resp.split("```transaction")[1].split("```")[0].strip()
            txn_list = json.loads(txn_str)
            for t in txn_list:
                txn = {
                    "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                    "user_id": user["user_id"],
                    "amount": float(t.get("amount", 0)), "category": t.get("category", "Other"),
                    "description": t.get("description", ""), "date": t.get("date", now.strftime("%Y-%m-%d")),
                    "type": t.get("type", "expense"), "created_by": "ai_chat",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.transactions.insert_one(txn)
                new_txns.append(await db.transactions.find_one({"transaction_id": txn["transaction_id"]}, {"_id": 0}))
            clean_resp = ai_resp.split("```transaction")[0].strip()
        except Exception:
            pass
    await db.chat_messages.insert_one({
        "message_id": f"msg_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "role": "user", "content": data.message, "created_at": datetime.now(timezone.utc).isoformat()
    })
    await db.chat_messages.insert_one({
        "message_id": f"msg_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "role": "assistant", "content": clean_resp, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"response": clean_resp, "new_transactions": new_txns}

@api_router.get("/chat/history")
async def get_chat_history(user=Depends(get_current_user)):
    return await db.chat_messages.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(100)

# --- Setup ---
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
