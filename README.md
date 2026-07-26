# atlas.ai

Testing : 

# backend
cd backend && venv/Scripts/uvicorn app.main:app --reload

# frontend
cd frontend && npm run build     -> go to chrome -> search -> chrome://extensions -> enable developer mode -> load unpacked -> select extension/.output/chrome-mv3

# extension — wxt opens a Chrome window with it loaded + hot reload
cd extension && npm run dev
