from fastapi import FastAPI

app = FastAPI(
    title="ResumeLoop API",
    description="College Peer Resume Review Platform",
    version="0.1.0"
)


@app.get("/")
def root():
    return {
        "message": "ResumeLoop API is running",
        "version": "0.1.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }