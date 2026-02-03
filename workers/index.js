export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GET /announcement?lang=xx
    if (request.method === "GET" && url.pathname === "/announcement") {
      try {
        const lang = url.searchParams.get("lang") || "en";
        const stmt = env.DB.prepare("SELECT content FROM announcements WHERE language = ?").bind(lang);
        const { results } = await stmt.all();
        
        let content = "";
        if (results && results.length > 0 && results[0].content) {
          content = results[0].content;
        } else {
          // Fallback to English if requested language not found
          if (lang !== 'en') {
            const fallback = await env.DB.prepare("SELECT content FROM announcements WHERE language = 'en'").first();
            if (fallback && fallback.content) {
              content = fallback.content;
            }
          }
        }

        // 确保返回的content是字符串（即使是空字符串）
        if (content === null || content === undefined) {
          content = "";
        }

        return new Response(JSON.stringify({ content: String(content) }), {
          headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache, no-store, must-revalidate" // 禁用缓存
          }
        });
      } catch (error) {
        console.error("Error fetching announcement:", error);
        return new Response(JSON.stringify({ 
          content: "",
          error: "Database query failed"
        }), {
          status: 500,
          headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    // POST /announcement (Admin only)
    if (request.method === "POST" && url.pathname === "/announcement") {
      try {
        const body = await request.json();
        const { language, content, signature, timestamp, adminAddress } = body;

        console.log('[API] POST /announcement request:', { language, contentLength: content?.length, adminAddress });

        // Validate input
        if (!language || !content) {
          console.error('[API] Missing required fields:', { language, hasContent: !!content });
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing required fields: language and content" 
          }), { 
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*" 
            }
          });
        }

        // ENV.ADMIN_ADDRESS should be set in Cloudflare Dashboard
        const OWNER = env.ADMIN_ADDRESS; 
        
        if (!OWNER) {
          console.error('[API] ADMIN_ADDRESS not configured');
          return new Response(JSON.stringify({ 
            success: false,
            error: "Server Config Error: ADMIN_ADDRESS not set" 
          }), { 
            status: 500,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*" 
            }
          });
        }

        // Verify admin address
        if (!adminAddress || adminAddress.toLowerCase() !== OWNER.toLowerCase()) {
          console.error('[API] Unauthorized address:', { adminAddress, expected: OWNER });
          return new Response(JSON.stringify({ 
            success: false,
            error: "Unauthorized Address" 
          }), { 
            status: 401,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*" 
            }
          });
        }

        // UPSERT - Check if exists
        const now = Date.now();
        console.log('[API] Checking if announcement exists for language:', language);
        
        const exists = await env.DB.prepare("SELECT 1 FROM announcements WHERE language = ?").bind(language).first();
        console.log('[API] Existence check result:', { exists: !!exists, language });
        
        let result;
        try {
          if (exists) {
            console.log('[API] Updating existing announcement for language:', language);
            result = await env.DB.prepare("UPDATE announcements SET content = ?, updated_at = ? WHERE language = ?")
                .bind(content, now, language).run();
            console.log('[API] UPDATE result:', { 
              success: result.success, 
              changes: result.changes,
              meta: result.meta 
            });
          } else {
            console.log('[API] Inserting new announcement for language:', language);
            result = await env.DB.prepare("INSERT INTO announcements (language, content, updated_at) VALUES (?, ?, ?)")
                .bind(language, content, now).run();
            console.log('[API] INSERT result:', { 
              success: result.success, 
              changes: result.changes,
              meta: result.meta 
            });
          }

          // Check if operation was successful
          if (!result.success) {
            console.error('[API] Database operation failed:', result);
            return new Response(JSON.stringify({ 
              success: false,
              error: "Database operation failed",
              details: result.meta || "Unknown error"
            }), { 
              status: 500,
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
              }
            });
          }

          // Verify the data was saved by reading it back (with retry)
          let verify = null;
          let retries = 3;
          while (retries > 0 && !verify) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms for consistency
            verify = await env.DB.prepare("SELECT content, updated_at FROM announcements WHERE language = ?").bind(language).first();
            if (!verify) {
              retries--;
              console.log('[API] Verification retry, attempts left:', retries);
            }
          }

          if (!verify) {
            console.error('[API] Verification failed - announcement not found after insert/update');
            return new Response(JSON.stringify({ 
              success: false,
              error: "Failed to verify announcement was saved - record not found" 
            }), { 
              status: 500,
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
              }
            });
          }

          // Check content match (allow for whitespace differences)
          const savedContent = String(verify.content || '').trim();
          const expectedContent = String(content).trim();
          
          if (savedContent !== expectedContent) {
            console.error('[API] Verification failed - content mismatch:', {
              expectedLength: expectedContent.length,
              savedLength: savedContent.length,
              expectedPreview: expectedContent.substring(0, 50),
              savedPreview: savedContent.substring(0, 50)
            });
            return new Response(JSON.stringify({ 
              success: false,
              error: "Failed to save announcement - content mismatch after save" 
            }), { 
              status: 500,
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
              }
            });
          }

          console.log('[API] ✅ Verification passed - announcement saved correctly');
        } catch (dbError) {
          console.error('[API] Database operation error:', dbError);
          return new Response(JSON.stringify({ 
            success: false,
            error: "Database error: " + (dbError.message || "Unknown database error"),
            details: dbError.stack
          }), { 
            status: 500,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*" 
            }
          });
        }

        console.log('[API] ✅ Announcement saved successfully:', { 
          language, 
          contentLength: verify.content.length, 
          updated_at: verify.updated_at,
          timestamp: new Date(verify.updated_at).toISOString()
        });

        return new Response(JSON.stringify({ 
          success: true,
          language,
          contentLength: content.length,
          updated_at: now
        }), {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache"
            }
        });

      } catch (e) {
        console.error('[API] Exception in POST /announcement:', e);
        return new Response(JSON.stringify({ 
          success: false,
          error: e.message || "Internal server error",
          details: e.stack
        }), { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          } 
        });
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
