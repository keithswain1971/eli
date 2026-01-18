# Deploying Eli Assistant

This guide covers how to deploy the Eli Assistant to **Cloudflare Pages** and embed it on your website.

## Prerequisites
-   A [Cloudflare](https://dash.cloudflare.com/) account.
-   Your project pushed to a Git repository (GitHub/GitLab).

## 1. Configure Next.js for Cloudflare
Cloudflare Pages uses `edge` runtime. We need to install the adapter.
*Note: Since Eli uses Supabase and OpenAI, it runs well on the Edge.*

### Run these commands locally:
```bash
npm install --save-dev @cloudflare/next-on-pages
```

### Add this script to `package.json`:
```json
"scripts": {
  "pages:build": "npx @cloudflare/next-on-pages",
  ...
}
```

### Commit and Push
Push these changes to your GitHub repository.

## 2. Deploy to Cloudflare Pages
1.  Log in to the **Cloudflare Dashboard**.
2.  Go to **Workers & Pages** -> **Create Application**.
3.  Select the **Pages** tab -> **Connect to Git**.
4.  Select your `eli-assistant` repository.
5.  **Build Settings**:
    -   **Framework Preset**: Next.js (Static HTML Export) -> *Change this to "None" if using next-on-pages, or follow the guide below.*
    -   **Build Command**: `npx @cloudflare/next-on-pages` (or `npm run pages:build`)
    -   **Output Directory**: `.vercel/output/static` (Cloudflare adapter outputs here)
6.  **Environment Variables**:
    You MUST add these in the Cloudflare Dashboard (Settings -> Environment Variables):
    -   `NEXT_PUBLIC_SUPABASE_URL`: (Your Supabase URL)
    -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Your Supabase Anon Key)
    -   `SUPABASE_SERVICE_ROLE_KEY`: (Your Service Role Key)
    -   `OPENAI_API_KEY`: (Your OpenAI Key)
    -   `STRAPI_API_URL`: (Your Strapi URL)
    -   `STRAPI_API_TOKEN`: (Your Strapi Token)

7.  Click **Save and Deploy**.

## 3. Embed on Your Website
Once deployed, Cloudflare will give you a valid URL (e.g., `https://eli-assistant.pages.dev`).

Add this code to your **Main Website's HTML** where you want the chat widget to appear (usually bottom right):

```html
<!-- Container for Eli -->
<div id="eli-widget-container" style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; z-index: 9999; border: none;">
    <iframe 
        src="https://eli-assistant.pages.dev/embed" 
        width="100%" 
        height="100%" 
        frameborder="0" 
        style="background: transparent;"
        allow="clipboard-write">
    </iframe>
</div>
```

**Note**: You may want to add a button on your site to toggle the visibility of this `div`, or use the widget's internal minimization if the iframe is sized appropriately.

## Alternative: Vercel (Easier)
If Cloudflare setup proves difficult, **Vercel** has zero-config support for Next.js.
1.  Go to [Vercel](https://vercel.com) -> Add New Project -> Import from GitHub.
2.  Add the Environment Variables.
3.  Deploy.
