from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import os

# New OpenAI SDK
import openai
from openai import OpenAI

# Load .env
load_dotenv()

# Initialize client with API key
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="PR Summarizer Microservice")

class PRInput(BaseModel):
    description: str = Field(..., min_length=10, max_length=1000)

@app.post("/summarize")
def summarize_pr(data: PRInput):
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that summarizes PR descriptions in a concise and professional manner."
                },
                {
                    "role": "user",
                    "content": f"Summarize this PR: {data.description}"
                }
            ],
            max_tokens=50,
            temperature=0.5
        )

        summary = response.choices[0].message.content.strip()
        return {"summary": summary}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
