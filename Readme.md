# Procurement Microservices Project

This repository includes three backend microservices for handling procurement processes:

- **Assignment 1** (Node.js): Business Rule Engine for processing PRs  
- **Assignment 3** (Python - FastAPI): AI-powered PR summarization using OpenAI  
- **Assignment 4** (Node.js): Permission-based PR filtering with Redis caching

---

## Table of Contents

- [Assignment 1 - Business Rule Processor (Node.js)](#assignment-1---business-rule-processor-nodejs)
- [Assignment 3 - PR Summarizer (Python)](#assignment-3---pr-summarizer-python)
- [Assignment 4 - Permission-Based PR Filtering (Node.js)](#assignment-4---permission-based-pr-filtering-nodejs)
- [Redis Setup using Docker](#redis-setup-using-docker)
- [Environment Variables](#environment-variables)
- [Sample Inputs and Outputs](#sample-inputs-and-outputs)
- [Notes](#notes)

---

## Assignment 1 - Business Rule Processor (Node.js)

### Objective

Create a Node.js API that applies predefined business rules to Purchase Requisition (PR) JSON payloads and returns the processed result.

### Setup

```bash
cd assignment-1-nodejs
npm install
```

### Run the API

```bash
npm start
```

This starts an Express server on port 3000.

### Endpoint

**POST /processPR**

### Description

- Loads rules from a `rules.json` file
- Calculates `deliveryDays` based on `createdDate` and `deliveryDate`
- Applies rules such as:
  - Auto-approval if `totalAmount < 10000`
  - Set urgency to High if `deliveryDays < 3`

### Sample Rule File (rules.json)

```json
{
  "approvalRules": [
    { "condition": "totalAmount < 10000", "action": "autoApprove", "setStatus": "Approved" },
    { "condition": "deliveryDays < 3", "action": "setUrgency", "urgency": "High" }
  ]
}
```

---

## Assignment 3 - PR Summarizer (Python)

### Objective

Create a FastAPI microservice that summarizes PR descriptions using OpenAI's GPT model.

### Setup

```bash
cd assignment-3-python
python -m venv venv
source venv/bin/activate     # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run the API

```bash
uvicorn main:app --reload
```

Server runs at http://localhost:8000.

### Endpoint

**POST /summarize**

### Environment Setup

Create a `.env` file inside `assignment-3-python/`:

```env
OPENAI_API_KEY=sk-your-openai-api-key
```

---

## Assignment 4 - Permission-Based PR Filtering (Node.js)

### Objective

Create a Node.js API that filters PR records based on the user's role and data permissions.

### Setup

```bash
cd assignment-4-nodejs
npm install
```

### Run the API

```bash
npm start
```

### Redis Requirement

This service connects to Redis to cache user permissions. See [Redis Setup using Docker](#redis-setup-using-docker).

### Endpoint

**GET /getPRs**

### Description

- Reads user role and permissions from Redis or local config
- Filters PR records by:
  - Allowed plants
  - Max allowed `totalAmount`

---

## Redis Setup using Docker

To run Redis locally via Docker:

```bash
docker run -d --name redis-local -p 6379:6379 redis
```

To check if Redis is running:

```bash
docker ps
```

Redis will run at `localhost:6379`.

---

## Environment Variables

Create a `.env` file inside `assignment-3-python/`:

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Get your API key from https://platform.openai.com/account/api-keys

---

## Sample Inputs and Outputs

### Assignment 1: /processPR

**Input:**
```json
{
  "prId": "PR001",
  "totalAmount": 8500,
  "createdDate": "2025-07-11",
  "deliveryDate": "2025-07-13"
}
```

**Output:**
```json
{
  "prId": "PR001",
  "totalAmount": 8500,
  "createdDate": "2025-07-11",
  "deliveryDate": "2025-07-13",
  "deliveryDays": 2,
  "status": "Approved",
  "urgency": "High"
}
```

### Assignment 3: /summarize

**Input:**
```json
{
  "description": "This PR is raised to procure 250 ergonomic office chairs for the Bangalore office to improve comfort and comply with ISO standards. Estimated cost: 1.2 million INR. Delivery in 4 weeks."
}
```

**Output:**
```json
{
  "summary": "Procurement of 250 ergonomic chairs for Bangalore office. Delivery in 4 weeks."
}
```

### Assignment 4: /getPRs

**Permissions:**
```json
{
  "role": "buyer",
  "dataPermissions": {
    "allowedPlants": ["PlantA", "PlantB"],
    "maxAmount": 50000
  }
}
```

**PR Collection:**
```json
[
  { "prId": "PR001", "plant": "PlantA", "totalAmount": 40000 },
  { "prId": "PR002", "plant": "PlantC", "totalAmount": 45000 },
  { "prId": "PR003", "plant": "PlantB", "totalAmount": 60000 },
  { "prId": "PR004", "plant": "PlantB", "totalAmount": 30000 }
]
```

**Filtered Output:**
```json
[
  { "prId": "PR001", "plant": "PlantA", "totalAmount": 40000 },
  { "prId": "PR004", "plant": "PlantB", "totalAmount": 30000 }
]
```

---

## Notes

- Use `.env` files to store secrets like OpenAI API keys
- Redis is used only in Assignment 4 and must be running locally
- Make sure ports 3000 (Node.js) and 8000 (Python) are available before running services
- Each microservice runs independently and can be deployed separately
- All services follow REST API conventions with proper HTTP status codes
- Error handling is implemented for invalid inputs and service failures