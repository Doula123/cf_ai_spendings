# AI Financial Analytics Dashboard

**[🔗 Live Demo](https://cf-ai-spendings.pages.dev)**

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white)
![Llama 3.3](https://img.shields.io/badge/Meta%20Llama%203.3-0467DF?style=for-the-badge&logo=meta&logoColor=white)

Full-stack financial platform that uses **Generative AI** to transform bank CSVs into a clean financial dashboard.

## Key Features 
 * **AI-Powered Normalization:** Uses Llama 3.3 to intelligently fix messy merchant names.
 * **Subscription Intelligence:** Automatically detects and isolates reccuring payments.
 * **Smart Categorization:** Uses LLama 3.3 to assign predetermined categories such as "Food & Drinks" or "Shopping" based on transaction context.
 * **Caching:** Implements a cache using **Cloudflare D1** to reduce latency by ~60%.
 * **Workflows:** Built on **Cloudflare Workflows** to ensure reliable large CSV files.

## Problem
 Bank Statements are unstructured and messy. Traditional determining methods are unreliable due to the infinite variations in descriptors: 

 For example : 'McDonalds #4029' and 'Mcdonalds 1150'

 **My Solution** : This app uses **Llama 3.3** to restructure these statements 

 >[!IMPORTANT] 
 >**Bank Compatibility:** This version is specifically optimized for **TD Bank (Canada)** CSV exports. Support for other major banks is on the way.

 ---

 ### System Architecture & Performance

 Processing finances using AI can be powerful but slow. To help solve this latency issue, I implemented a **cache** using **Cloudflare D1**

 How it works: 

 1. **Checks Cache** App hashes the raw string and checks D1.
 2. **Cache Miss** If its a new transaction, the AI performs an **analysis**
    * **Normalize** Extracts the clean merchant name using AI ('Netflix').
    * **Categorize** Categorizes the transaction based on context using AI ('Entertainment')
 3. **Write Back**  These 2 data points are then saved in D1 memory.
 4. **Result** Next time, the app retrieves the analysis immediately, skipping the AI to save costs and tokens.


 ### Real-World Performance 
 *Mesured using logs in Cloudflare workflow*

| Operation | Fresh Request (Full AI) | **Cached Request** |
| :--- | :--- | :--- |
| **Latency** | **~1.3s** per transaction | **~500ms** (Workflow Overhead) |
| **Cost** | GPU Inference Tokens | **Zero** (State Lookup) |
| **Scalability** | Linear (depends on model speed) | **Constant Time** |

## Installation & Setup

### Before Starting
* **Node.js**
* **Cloudflare Wrangler CLI** 
* **Cloudflare account** 

### Installation

1. *Clone Repository** 
    ```bash
    git clone https://github.com/Doula123/cf_ai_spendings.git
    cd cf_ai_spendings
    ```
2.  **Install dependencies**
    ```bash
    cd backend && npm install
    cd ../frontend && npm install
    ```
3. **Environmental Configuration** 
    create a .env in frontend folder for backend communication
    ```bash
    VITE_API_URL=http://localhost:8787
    ```

4.  **Create the Database**
    Initialize a new D1 database on Cloudflare:
    ```bash
    cd ../backend
    npx wrangler d1 create ai-spending-db
    ```
    * **Copy the `database_id`** (UUID) that is printed in your terminal.*

5.  **Configure Wrangler**
    Open `wrangler.jsonc` and replace the placeholder `database_id` with the UUID you just copied.

    ```jsonc
    // wrangler.jsonc
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "ai-spending-db",
        "database_id": "<PASTE_YOUR_NEW_ID_HERE>" // <--- UPDATE THIS BEFORE NEXT STEP
      }
    ]
    ```

6.  **Apply Database Migrations**
    Now that Wrangler knows your Database ID, apply the existing schema (migrations) from the repo:
    ```bash
    npx wrangler d1 migrations apply ai-spending-db --remote
    ```
    *Select "Yes" when asked to confirm.*


## Running the Application

### Local Development 

To test the AI feautres and workflow locally, must use **'--remote'** flag. This allows for local environment to securely connect Cloudflare's GPU Network and D1 database.

Must open 2 terminals. 

1. Start the backend (First terminal)

    ```bash
     cd backend
    npx wrangler dev --remote
    ```
2. Start the frontend (Second terminal) 

    ```bash
     cd frontend
     npm run dev
    ```

## Usage

1. **Access the page:** Open `http://localhost:5173` in your browser.
2. **Upload Data:** Drag and drop your **TD Bank CSV** or  **Placeholder format CSV** into the upload zone.
3. **AI Analysis:** The frontend triggers the **Cloudflare Workflow**, which calls Llama 3.3 to normalize and categorize each row.
4. **Identify Subscriptions:** Results will load after Analysis.
5. **Verify Cache:** Upload the same file again; you will notice the processing time drops significantly as results are pulled from the **D1 Cache**.