from fastapi import FastAPI

app = FastAPI(
    title="ResumeLoop API",
    description="College Peer Resume Review Platform",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "message": "Welcome to ResumeLoop API",
        "version": "0.1.0",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
    }