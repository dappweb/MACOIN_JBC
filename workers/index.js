export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GET /announcement?lang=xx
    if (request.method === "GET" && url.pathname === "/announcement") {
      const lang = url.searchParams.get("lang") || "en";
      const stmt = env.DB.prepare("SELECT content FROM announcements WHERE language = ?").bind(lang);
      const { results } = await stmt.all();
      
      let content = "";
      if (results && results.length > 0) {
        content = results[0].content;
      } else {
        // Fallback to English
        const fallback = await env.DB.prepare("SELECT content FROM announcements WHERE language = 'en'").first();
        if (fallback) content = fallback.content;
      }

      return new Response(JSON.stringify({ content }), {
        headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    // POST /announcement (Admin only)
    if (request.method === "POST" && url.pathname === "/announcement") {
      try {
        const body = await request.json();
        const { language, content, signature, timestamp, adminAddress } = body;

        // Verify Admin (Simplified: Check if address is hardcoded admin)
        // In production: Verify signature using ethers.utils.verifyMessage
        // Here we just simulate auth logic or assume the frontend sends a valid signature
        // that we would verify against a hardcoded OWNER address.
        
        // For this template, we'll assume the request includes a "secret" or we just trust the signature logic stub.
        // Let's implement a basic check.
        
        // ENV.ADMIN_ADDRESS should be set in Cloudflare Dashboard
        const OWNER = env.ADMIN_ADDRESS; 
        
        if (!OWNER) {
             return new Response("Server Config Error: ADMIN_ADDRESS not set", { status: 500 });
        }

        // Verify signature (Pseudo-code as 'ethers' might not be available in standard worker runtime without polyfills)
        // If you bundle ethers, you can do:
        // const recovered = ethers.utils.verifyMessage(`Update Announcement: ${content}`, signature);
        // if (recovered !== OWNER) return new Response("Unauthorized", { status: 401 });

        // For now, we will assume the client sent the correct address and we match it.
        if (adminAddress.toLowerCase() !== OWNER.toLowerCase()) {
             return new Response("Unauthorized Address", { status: 401, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        // UPSERT
        // Check if exists
        const exists = await env.DB.prepare("SELECT 1 FROM announcements WHERE language = ?").bind(language).first();
        
        if (exists) {
            await env.DB.prepare("UPDATE announcements SET content = ?, updated_at = ? WHERE language = ?")
                .bind(content, Date.now(), language).run();
        } else {
            await env.DB.prepare("INSERT INTO announcements (language, content, updated_at) VALUES (?, ?, ?)")
                .bind(language, content, Date.now()).run();
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
            }
        });

      } catch (e) {
        return new Response("Error: " + e.message, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
