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

    // GET /level-override?address=0x... - 获取等级覆盖
    if (request.method === "GET" && url.pathname === "/level-override") {
      const address = url.searchParams.get("address");
      if (!address) {
        return new Response(JSON.stringify({ error: "Missing address" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const result = await env.DB.prepare("SELECT level FROM level_overrides WHERE address = ?")
        .bind(address.toLowerCase()).first();
      
      return new Response(JSON.stringify({ 
        address: address.toLowerCase(),
        level: result ? result.level : null,
        hasOverride: !!result
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // GET /level-overrides - 获取所有等级覆盖 (Admin)
    if (request.method === "GET" && url.pathname === "/level-overrides") {
      const { results } = await env.DB.prepare("SELECT address, level, updated_at FROM level_overrides ORDER BY updated_at DESC").all();
      
      return new Response(JSON.stringify({ overrides: results || [] }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // POST /level-override - 设置等级覆盖 (Admin only)
    if (request.method === "POST" && url.pathname === "/level-override") {
      try {
        const body = await request.json();
        const { address, level, adminAddress } = body;

        const OWNER = env.ADMIN_ADDRESS;
        if (!OWNER) {
          return new Response("Server Config Error: ADMIN_ADDRESS not set", { status: 500 });
        }

        if (!adminAddress || adminAddress.toLowerCase() !== OWNER.toLowerCase()) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { 
            status: 401, 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
          });
        }

        if (!address) {
          return new Response(JSON.stringify({ error: "Missing address" }), { 
            status: 400, 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
          });
        }

        const normalizedAddress = address.toLowerCase();

        // level = null or 0 means remove override
        if (level === null || level === 0) {
          await env.DB.prepare("DELETE FROM level_overrides WHERE address = ?")
            .bind(normalizedAddress).run();
          return new Response(JSON.stringify({ success: true, action: "removed" }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        // Validate level (1-9)
        if (level < 1 || level > 9) {
          return new Response(JSON.stringify({ error: "Invalid level (must be 1-9)" }), { 
            status: 400, 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
          });
        }

        // UPSERT
        const exists = await env.DB.prepare("SELECT 1 FROM level_overrides WHERE address = ?")
          .bind(normalizedAddress).first();
        
        if (exists) {
          await env.DB.prepare("UPDATE level_overrides SET level = ?, updated_at = ? WHERE address = ?")
            .bind(level, Date.now(), normalizedAddress).run();
        } else {
          await env.DB.prepare("INSERT INTO level_overrides (address, level, updated_at) VALUES (?, ?, ?)")
            .bind(normalizedAddress, level, Date.now()).run();
        }

        return new Response(JSON.stringify({ success: true, address: normalizedAddress, level }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        });
      }
    }

    // GET /burn-status - 获取燃烧状态
    if (request.method === "GET" && url.pathname === "/burn-status") {
      try {
        const RPC_URL = 'https://chain.mcerscan.com/';
        const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';
        
        // 调用合约获取数据
        const rpcCall = async (method, params) => {
          const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          return data.result;
        };

        // lastBurnTime() selector: 0xe3067449
        const lastBurnTimeHex = await rpcCall('eth_call', [
          { to: PROTOCOL_ADDRESS, data: '0xe3067449' },
          'latest',
        ]);
        const lastBurnTime = parseInt(lastBurnTimeHex, 16);

        // swapReserveJBC() selector: 0x1d0dac76
        const jbcReserveHex = await rpcCall('eth_call', [
          { to: PROTOCOL_ADDRESS, data: '0x1d0dac76' },
          'latest',
        ]);
        const jbcReserve = BigInt(jbcReserveHex);

        const now = Math.floor(Date.now() / 1000);
        const nextBurnTime = lastBurnTime + 24 * 3600;
        const canBurn = now >= nextBurnTime;
        const expectedBurn = jbcReserve / 100n;

        return new Response(JSON.stringify({
          canBurn,
          lastBurnTime: new Date(lastBurnTime * 1000).toISOString(),
          nextBurnTime: new Date(nextBurnTime * 1000).toISOString(),
          secondsUntilBurn: Math.max(0, nextBurnTime - now),
          jbcReserve: Number(jbcReserve) / 1e18,
          expectedBurnAmount: Number(expectedBurn) / 1e18,
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
