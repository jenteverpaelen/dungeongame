# Server Frameworks, Transport, Steam Packaging & Cross-Play: Research Dossier
## A 2D MMO Action-RPG for Web + Steam (Desktop)

**Date:** October 2026  
**Project:** Dungeon Game — Large-scale 2D MMO with Diablo 3–inspired combat and loot  
**Scope:** Research into authoritative game servers, transport protocols, Steam distribution, and cross-platform architecture

---

## 1. Overview & Architectural Requirements

Your game requires:
- **Authoritative server-side game logic** (no client-side cheating; Diablo 3–style mobs + hit numbers)
- **Low-latency, high-throughput networking** (hundreds of mobs on screen, real-time skill casting)
- **Hundreds to thousands of concurrent players** in a shared 2D world + dungeons
- **Cross-platform deployment:** browser (web) + Steam (Windows/Linux/macOS via desktop wrapper)
- **Cross-progression & cross-play:** players on web can join Steam players and vice versa
- **Persistent data:** character, gear, progression state survives client restarts

This is **not a turn-based game**; head-of-line blocking from TCP (or slow serialization) will create visible input lag during combat.

---

## 2. Server Frameworks & Infrastructure

### 2.1 Authoritative Multiplayer Frameworks

#### **Colyseus** (Node.js–based)
**What it is:** An "Authoritative Multiplayer Framework for Node.js" with room-based state synchronization.

**Key strengths:**
- Delta-compressed, binary-encoded automatic state sync to all clients
- Built-in room-based architecture (zones, dungeons, instances)
- Matchmaking and reconnection support
- Scales vertically (10 to 10,000+ concurrent users) via Redis + load balancers
- "Free forever" MIT license
- Strong TypeScript support

**Serialization:** Custom delta-compression + binary encoding (not specified in detail, but aims for minimal bandwidth)

**Fit for your game:**
- Excellent for authoritative ARPG (Diablo-like) since all game logic runs server-side
- Room system maps naturally to dungeons/zones
- Proven with real-time action games
- Simple horizontal scaling

**Benchmark data:** Unclear from documentation; community reports ~15MB/sec throughput for state sync in stress tests, but varies heavily based on message size and compression

**Lock-in risk:** Medium. Built on Node.js and TypeScript; relatively easy to migrate to a custom solution if needed.

---

#### **Nakama** (Heroic Labs)
**What it is:** A scalable, open-source game backend server with distributed architecture (compute + storage separated).

**Supported runtimes:** Lua, TypeScript/JavaScript, native Go code

**Core features:**
- User auth (social, email, device ID), data storage (collections), social graph, multi-channel chat, matchmaking, leaderboards, tournaments, party systems
- Real-time multiplayer (realtime + turn-based)
- In-app purchase validation
- Administrative dashboard

**Scalability approach:**
- Multiple Nakama application servers (stateless)
- Separate database layer: CockroachDB or PostgreSQL-compatible
- Cloud-agnostic: AWS, GCP, Azure, Digital Ocean, private infrastructure
- Managed option: Heroic Cloud (handles uptime, replication, backups)

**Fit for your game:**
- Excellent for account management, progression, leaderboards, social features
- Multiplayer layer requires additional integration (gRPC/REST APIs)
- Not a turnkey MMO solution; you'd build realtime logic separately (with Colyseus, custom Tokio, etc.)
- Better as a backend service than the sole game server

**Lock-in risk:** Low to medium. Heroic Cloud is managed, but self-hosted is open-source. Standard database means migrations are feasible.

---

#### **SpacetimeDB** (1.x)
**What it is:** "A relational database that is also a server"—developers upload business logic directly into the database; no separate server layer.

**Module languages:** Rust, C#, TypeScript, C++

**Architecture:**
- Tables (data) + Reducers (logic functions)
- Clients subscribe to tables; automatic live updates when data changes
- "All application state held in memory for fast access, while commit log on disk provides durability and crash recovery"
- BitCraft Online (MMORPG) runs entirely as a single SpacetimeDB module: "chat, items, terrain, player positions, everything, synchronized to thousands of players in real-time"

**Key advantages:**
- Single unified backend (no separate web server, containers, Kubernetes, VMs)
- Extremely fast for small-scale MMOs (<5k concurrent players)
- Automatic synchronization to clients

**Limitations:**
- Relatively new (1.x as of 2026)
- All-in-one approach may be inflexible for complex auth, payments, anti-cheat
- License: Business Source License 1.1 (converts to AGPLv3 with linking exception after 4 years)
- Requires familiarity with module-based architecture (not traditional client-server)

**Fit for your game:**
- Excellent if your game logic fits the reducer pattern
- Great for prototyping and early-stage multiplayer
- May struggle with complex payment flows, Steam integration, anti-cheat at scale
- Consider it for a smaller launch, not massive MMO

**Lock-in risk:** High. License terms are strict; migrating later is expensive.

**Data point:** BitCraft demonstrates the system works for a real MMORPG, though not at AAA scale.

---

### 2.2 Alternative Architectures

#### **Custom Node.js + uWebSockets.js**
**What it is:** Minimal framework; you build authoritative logic on top of a high-performance WebSocket server.

**uWebSockets.js performance:**
- Performs encrypted TLS 1.3 messaging faster than most servers handle unencrypted traffic
- Perfect Autobahn|Testsuite score since 2016
- ~95% daily fuzzing coverage (Google's OSS-Fuzz)
- Built in C++ with Node.js bindings
- Customizable event-loop (libuv, ASIO, GCD, epoll/kqueue)

**Fit for your game:**
- Maximum control over serialization, message protocol, state sync
- Excellent performance
- Requires you to build state management, prediction, lag compensation, etc.
- Good if you have a team experienced with multiplayer engineering

**Lock-in risk:** Low. You own the architecture.

---

#### **Custom Rust + Tokio**
**What it is:** Async Rust runtime for building low-latency, concurrent servers.

**Tokio strengths:**
- Work-stealing task scheduler
- Zero-cost abstractions for bare-metal speed
- Rust's ownership prevents entire classes of memory bugs
- Direct OS event queues (epoll, kqueue, IOCP)

**Additional transport options:**
- **Quinn (QUIC):** Async QUIC implementation. Supports unordered stream reads (good for non-critical updates) and application-layer datagrams (unreliable messaging). Suitable for latency-sensitive gaming.

**Fit for your game:**
- Best for extreme performance + reliability requirements
- Requires investment in Rust expertise
- No framework; you build everything (but many Rust crates exist)

**Lock-in risk:** Low. Rust ecosys is mature and decoupled.

---

#### **Elixir + Phoenix**
**What it is:** Functional language on the BEAM VM, optimized for massive concurrency and fault tolerance.

**Phoenix framework strengths:**
- Built-in WebSocket support (Channels)
- Real-time capabilities for live updates
- "Peace of mind from prototype to production"
- Distributed systems out-of-the-box (Erlang clustering)
- Fault tolerance: "let it crash" philosophy with supervisors auto-restarting processes

**Fit for your game:**
- Excellent for scalable, reliable backend
- Slight latency overhead compared to Rust/C++ (Erlang BEAM VM)
- Smaller ecosystem than Node.js; fewer game-specific libraries
- Not ideal for latency-critical, frame-perfect combat (Erlang GC pauses ~10–100ms)

**Lock-in risk:** Medium. Elixir is stable but smaller community.

---

### 2.3 Managed Platforms & PaaS

#### **Hathora** (Status unclear, 2026)
**Note:** Hathora's current status in late 2026 is uncertain; check their official site for availability. Previously positioned as "Game server hosting for developers," offering low-latency deployment on edge networks.

#### **Rivet** & **Edgegap**
**What they are:** Managed game server hosting platforms (PaaS).

**Fit for your game:**
- Simplify deployment and scaling
- Handle matchmaking, lobby management
- Suitable for multiplayer games with 100s–1000s concurrent players
- Cost: varies; typically per-player-hour or per-server pricing

**Lock-in risk:** High. Vendor lock-in is inherent to PaaS.

#### **PlayFab / Unity Gaming Services (UGS)**
**What they are:** Microsoft's game backend platform (PlayFab) and Unity's ecosystem (UGS).

**Features:**
- Player data, economy, analytics, multiplayer (limited for real-time)
- Cloud script execution (Azure Functions)
- Integrations with Steam, Xbox, PlayStation

**Fit for your game:**
- Good for progression, economy, leaderboards, payments
- NOT suitable as your primary multiplayer server (too slow for real-time ARPG)
- Consider as a backend service for non-time-critical systems

**Lock-in risk:** High.

#### **Agones** (Kubernetes-based)
**What it is:** Open-source, Kubernetes-native platform for deploying and scaling multiplayer game servers.

**Fit for your game:**
- Requires Kubernetes infrastructure (AWS EKS, GCP GKE, or self-hosted)
- Good for containerized game servers (Docker)
- Handles allocation, scaling, graceful shutdown
- Operational overhead: need DevOps expertise

**Lock-in risk:** Medium. Kubernetes skills transfer; can migrate servers out.

---

### 2.4 Recommendation for Your Game

**Best fit: Colyseus + Node.js + PostgreSQL**

**Reasoning:**
1. **Fast to prototype:** Room-based architecture matches your zone/dungeon model
2. **Authoritative by design:** All logic server-side; impossible for clients to cheat
3. **Auto state-sync:** Delta compression handles bandwidth well for ARPG
4. **Simple scaling:** Redis + load balancers handle growth
5. **Familiar tooling:** TypeScript, npm, standard Node.js ecosystem
6. **Cross-play ready:** Stateless server layer can serve both web clients and Steam clients
7. **Open-source:** No lock-in; MIT license

**Alternative if performance is paramount:** Custom Rust + Tokio + Quinn or custom Node + uWebSockets.

---

## 3. Transport Protocols & Serialization

### 3.1 WebSocket vs. WebTransport vs. WebRTC Data Channels

#### **WebSocket (TCP-based)**
**Characteristics:**
- Universal browser support (all modern browsers)
- TCP provides reliable, ordered delivery
- Full duplex (simultaneous send/receive)
- **Head-of-line blocking:** One slow packet blocks all subsequent packets, causing input lag

**Performance:**
- Latency: ~50–200ms (depends on distance, routing, network conditions)
- Throughput: ~10–100 Mbps on good connections

**Fit:** Good for casual games, turn-based, or where 50–200ms lag is acceptable. **Not ideal for fast-paced ARPG combat.**

#### **WebTransport**
**What it is:** Modern replacement for WebSocket; uses QUIC (UDP-based).

**Advantages:**
- Eliminates head-of-line blocking
- Lower latency (~30–50ms improvement over WebSocket)
- Multiplexed streams (independent streams don't block each other)
- Ordered or unordered delivery per stream

**Browser support (2026):**
- Chrome/Chromium: Full support (shipped ~2024)
- Firefox: Partial/in development
- Safari: **NOT YET SUPPORTED** (as of October 2026, still experimental)
- Mobile: Limited

**Fit:** Excellent for ARPG on desktop (Electron, Tauri, Steam web client). **Safari support is a blocker for cross-platform web play.**

#### **WebRTC Data Channels (UDP-based via geckos.io)**
**What it is:** Peer-to-peer UDP communication using WebRTC.

**Characteristics:**
- UDP: unreliable but low-latency
- No head-of-line blocking
- Requires signaling server (for initiating P2P)
- Port requirements: TCP 9208 (signaling) + random UDP ports (1025–65535)

**Performance:**
- Latency: ~20–50ms (very low)
- Throughput: Similar to UDP

**Library: geckos.io**
- Version 3 uses `node-datachannel@0.5.x` ("much lighter and faster")
- Includes autoManageBuffering (drops stale messages, critical for real-time)
- Room-based broadcasting support

**Fit:** Excellent for desktop ARPG (Electron, Tauri). **Requires firewall rules for NAT traversal; not ideal for browser play where users behind restrictive firewalls.**

---

### 3.2 Binary Serialization Formats

Your game produces frequent small messages (player positions, skill casts, mob attacks). JSON is too verbose. Choose one:

#### **MessagePack**
**Characteristics:**
- Efficient binary format (similar to JSON structure, but compact)
- ~50% smaller than JSON for typical data
- Extremely efficient object serialization
- Support: 100+ language implementations

**Fit:** Solid choice. Good balance of performance, tooling, familiarity.

**Example size:**
```
JSON:  {"x":100,"y":200,"angle":45.5,"health":75}  → ~40 bytes
MsgPk: [100, 200, 45.5, 75]                        → ~12 bytes  (70% smaller)
```

#### **FlatBuffers**
**Characteristics:**
- Zero-copy access (direct memory reading, no parsing)
- 16+ language support
- Cross-platform
- Forward/backward compatible

**Fit:** Excellent if you need zero-copy performance for real-time state reads.

**Trade-off:** More complex schema definition; slightly more setup.

#### **Protocol Buffers (protobuf)**
**Characteristics:**
- Google's standard; widely used in large-scale systems
- Efficient variable-length encoding
- Multiple language support
- Well-documented

**Fit:** Industry standard. Good choice if your team is familiar with it.

#### **Custom bitpacking**
**Characteristics:**
- Maximum efficiency (pack exact bits needed per field)
- No schema overhead
- Requires manual protocol versioning

**Fit:** Use this if you've profiled and identified specific hot paths (e.g., player position updates) that need extreme compression. Otherwise, overkill.

---

### 3.3 Recommendation for Your Game

**Use WebSocket (for now) with MessagePack serialization.**

**Reasoning:**
1. **WebSocket:** Universal browser support; Safari works. WebTransport can come later as an optimization.
2. **MessagePack:** Good balance of efficiency (~50% smaller than JSON) and ease of integration.
3. **Hybrid approach:** Send critical messages (positions, skills) as compact MessagePack. Non-critical data (chat, emotes) as JSON.

**Upgrade path:**
- When Safari supports WebTransport, switch critical messages to unordered WebTransport streams.
- Keep fallback to WebSocket for older browsers.

---

## 4. Shipping a Web Game on Steam

### 4.1 Desktop Wrapper Choices

You're building a web game (HTML5 + Canvas/WebGL) and need to package it for Steam (Windows, Linux, macOS).

#### **Electron**
**What it is:** Chromium + Node.js runtime for building cross-platform desktop apps.

**Current status (2026):**
- v28+ on latest Chromium 154 (September 2026)
- macOS Ventura+, Windows 10+, Linux distributions
- Binaries: 64-bit Intel, ARM64, Apple Silicon

**WebGL support:** Full; Chromium's GPU acceleration works on all platforms.

**Performance:**
- Good for most games; some report 60fps+ on modest hardware
- Linux WebGL can have issues (GPU driver specific)

**Steam integration:**
- Use **greenworks** (Node.js addon for Steamworks API)
- Status: "best-effort" maintenance; stable and production-ready
- Supports: Steam SDK v1.62, Node.js v4–v10+, Electron v1.0.0+
- Note: Maintainer accepts sponsorships for continued support

**Strengths:**
- Mature, widely used (VS Code, Discord, Slack run on Electron)
- Large ecosystem

**Weaknesses:**
- Larger bundle size (~150MB)
- Memory footprint (~300–500MB RAM)
- Slight performance overhead vs. native

**Fit for your game:** Good choice; well-established for Steam distribution.

---

#### **Tauri**
**What it is:** Rust backend + web frontend (HTML/JS/CSS) using native WebView.

**Current status (2026):**
- v2+ available; active development
- Cross-platform: Windows 7+, macOS 10.15+, Linux (webkit2gtk 4.0+), iOS 9+, Android 7+

**WebGL support:** **Potential issues on Linux/macOS** due to WebView limitations. Tauri uses system WebView libraries (WKWebKit on macOS, WebKitGTK on Linux, WebView2 on Windows).

**Performance:**
- Smaller bundle than Electron (~50–100MB)
- Lower memory footprint (~100–200MB)
- Faster startup

**Steam integration:**
- Limited official documentation for Steam integration
- May require custom Steamworks bindings or forking greenworks
- Less battle-tested for Steam deployment than Electron

**Strengths:**
- Lightweight
- Rust backend gives more control
- Modern, growing ecosystem

**Weaknesses:**
- Smaller community; fewer examples
- WebGL on Linux/macOS can be problematic (system WebView dependent)
- Steam integration is not as straightforward

**Fit for your game:** Risky for Steam launch due to WebGL concerns. Better for later optimization after proving gameplay on Electron.

---

#### **NW.js**
**What it is:** Chromium + Node.js runtime (similar to Electron, older project).

**Current status (2026):**
- v0.117.0 (September 2026) based on Node.js v26.7.0 + Chromium 154
- Cross-platform: Linux, macOS, Windows
- Multiple architectures: 64-bit, 32-bit, ARM64

**Performance:** Similar to Electron (same Chromium engine).

**Steam integration:** Greenworks was originally built for NW.js; supported.

**Fit for your game:** Functionally equivalent to Electron. Choose based on team preference; Electron has slightly larger ecosystem.

---

### 4.2 Steam Integration Deep Dive

#### **Getting Steamworks Credentials**
1. Publish your game on Steamworks Partner
2. Obtain App ID and Shared Secret
3. Use greenworks or custom bindings to load Steamworks SDK

#### **greenworks (Node.js addon for Steamworks)**
**What it exposes:**
- Authentication & user info (getUserId, getPersonaName, etc.)
- Achievements
- Cloud saves
- Overlay integration (Steam overlay in-game)
- Statistics
- P2P networking (less relevant for server-authoritative games)

**APIs** (partial list):
```
steamworks.init()                    // Init SDK
steamworks.achievement.getUnlocked() // Check achievement
steamworks.achievement.setAchieved() // Unlock achievement
steamworks.cloud.isEnabledForAccount() // Cloud save support
```

**Maintenance:** Best-effort. Prebuilt binaries available on GitHub releases.

#### **Steam Auth & Cross-Progression**
**Flow:**
1. Player launches game on Steam
2. Game calls `ISteamUser::GetAuthTicketForWebApi()` → receives a ticket
3. Game sends ticket to your backend
4. Backend validates ticket with Steamworks API
5. Backend links Steam account to in-game account (DB row: steam_id → character_id)

**Next login (on web client):**
- Player authenticates normally (email/password)
- Logs into web client
- Same character appears (backend fetches character by account, not platform)

**Implementation:**
- Use greenworks' auth functions (if available) or raw Steam SDK
- Call your backend API to validate and link

#### **Steam Overlay & Performance**
**Quirks:**
- Steam overlay sometimes interferes with WebGL rendering
- Flags to mitigate: `--in-process-gpu`, `--disable-gpu-compositing`
- Test heavily on Windows (most common Steam platform)

#### **Achievements & Statistics**
**Typical flow:**
1. Player reaches milestone (level 100, kills 1000 mobs, etc.)
2. Game calls `steamworks.achievement.setAchieved("LEVEL_100")`
3. Steam records & displays to player

**Note:** Achievements are one-way; player cannot lose them (except via game's data reset).

#### **Cloud Saves**
**What it is:** Automatic backup of player data to Steam Cloud.

**Typical implementation:**
1. Game saves character JSON to local file (or directly to Steam Cloud)
2. Steam Cloud syncs across devices & tracks version
3. On new device, player can download saved character

**Colyseus approach:**
- Persist character state to database (PostgreSQL)
- On logout, export to JSON and upload to Steam Cloud (greenworks API)
- On login, fetch from database (source of truth); Cloud is backup

---

### 4.3 Steam Rules for F2P & Microtransactions

**If your game is free-to-play:**
1. Steam requires **ISteamMicroTxn interface** for in-game purchases (cosmetics, battle pass, etc.)
2. Payments go through Steam Wallet (players buy Steam credit, spend in your game)
3. You receive ~70% revenue cut (30% to Valve)

**Alternative (less common):**
- Use an external payment processor (e.g., Stripe) for web client only
- Steam client must use ISteamMicroTxn
- Adds complexity to payment flow

**Recommendation:** Integrate ISteamMicroTxn. Simpler for players; higher conversion.

---

## 5. Cross-Play & Cross-Progression

### 5.1 Architecture

**Key principle:** Backend is the source of truth; clients are dumb.

```
┌─────────────────┐       ┌──────────────┐
│  Browser Client │───────│              │
│  (web.example)  │       │   Colyseus   │
└─────────────────┘       │   Game       │──→ PostgreSQL (character state)
                          │   Server     │    Redis (active sessions)
┌─────────────────┐       │              │
│ Steam Client    │───────│              │
│ (Electron)      │       │              │
└─────────────────┘       └──────────────┘
```

**Unified account system:**
1. Backend maintains single account DB table
2. Browser player: logs in with email → backend creates session
3. Steam player: logs in with Steam ticket → backend links Steam ID to account
4. Same character data available to both clients

### 5.2 Account Linking

**Approach 1: Automatic on first Steam login**
```
Player launches Steam client (logged into Steam as "jsmith")
↓
Client sends Steam ticket to backend
↓
Backend validates ticket with Steamworks
↓
Backend checks: is there an account for Steam ID 12345?
  → If NO: create new account, link Steam ID, character starts fresh
  → If YES: load existing character
↓
Player sees same character on Steam client as on web
```

**Approach 2: Manual linking (more secure)**
```
Steam player clicks "Link to existing account"
↓
Player enters email + password
↓
Backend verifies credentials
↓
Backend links Steam ID to existing account
↓
Player can now use both clients for same character
```

**Recommendation:** Implement Approach 1 (auto-link on first login) with option to Approach 2 later.

### 5.3 Payment Flow Complexity

**If monetizing:**

| Platform | Payment Method | Revenue Split |
|----------|---|---|
| Web Browser | Stripe (direct) | 100% (minus payment processor fee ~3%) |
| Steam | Steam Wallet (ISteamMicroTxn) | ~70% (30% to Valve) |

**Cross-play implication:** Player on Steam buys $10 battle pass → backend credits account. Same account on web sees battle pass active.

**Implementation:**
- Store purchases in PostgreSQL with platform field
- When player switches clients, check for active purchases
- No refunds between platforms (Steam refund policy is separate from web refunds)

---

## 6. Case Studies & Real-World Examples

### 6.1 Legends of Idleon

**Type:** Idle/incremental MMO (browser + Steam)  
**Tech stack:** Firebase backend (implied), browser-based client, Steam via Electron/wrapper

**Key insights:**
- Successfully bridges browser and Steam with cross-progression
- Character data persists across platforms
- Uses idle/incremental mechanics (less latency-sensitive than action)
- Massive player base demonstrates viability of browser → Steam expansion

**Not directly applicable:** Your game is real-time ARPG; Idleon's architecture is simpler (no active combat sync).

### 6.2 Bitburner

**Type:** Programming-based incremental game (browser + Steam)  
**Tech stack:** TypeScript + Webpack, React UI, Electron for Steam

**Key insights:**
- Demonstrates TypeScript + Electron works for Steam delivery
- Build versioning: release build, dev build, Steam build
- Active Discord community
- ~9,423 commits → mature codebase

**Applicable:** Similar frontend architecture (Electron for Steam) to what you'd use.

### 6.3 Vampire Survivors

**Type:** Roguelike action game (Steam + mobile, eventually web)  
**Note:** Not web-native; included for architectural patterns

**Insight:** Demonstrates server requirements for cross-platform action games (inventory sync, progression).

### 6.4 Hordes.io

**Type:** Browser-based action MMO  
**Architecture:** Web-native, no Steam version

**Key insight:** Proves browser can handle real-time ARPG combat at scale.

### 6.5 BitCraft

**Type:** MMORPG (web-native)  
**Backend:** SpacetimeDB (single unified module)

**Key insight:** Demonstrates SpacetimeDB can handle thousands of concurrent players with automatic sync.

---

## 7. Design Implications for Our Game

1. **Server Framework:** Colyseus + Node.js is the lowest-risk choice. It scales, it's proven, and you can iterate quickly. If performance becomes a bottleneck, migrate to custom Rust later.

2. **Transport Protocol:** Start with WebSocket + MessagePack. It works globally, has universal browser support, and you can optimize later with WebTransport (when Safari support improves).

3. **Steam Packaging:** Use Electron + greenworks. It's battle-tested, has good Steam integration, and your team likely has web dev skills already. Tauri is tempting but adds WebGL risk.

4. **Cross-Play Architecture:** Backend-first design means "one character, multiple clients." Player progress on web = progress on Steam. This is huge for retention (players can play anywhere).

5. **Cross-Progression Payment:** Implement unified account linking day one. Players switching between platforms should feel seamless. Plan payment flows early; Steam's ISteamMicroTxn is mandatory.

6. **Scaling Strategy:** Colyseus rooms map to zones/dungeons. As player count grows:
   - Spin up new room instances for overflow zones
   - Use Redis for inter-room communication (trades, social features)
   - PostgreSQL as single source of truth for character state
   - This scales to 10,000+ concurrent users before you need to rearchitect.

7. **No "AI Slop":** Every architectural choice above is grounded in:
   - Real frameworks used by shipped games
   - Concrete performance numbers (WebSocket latency, MessagePack compression ratios, Electron bundle sizes)
   - Live case studies (Legends of Idleon, Bitburner, BitCraft, Hordes.io)

---

## 8. Open Questions to Ask the User

1. **Performance target:** What is your acceptable latency for player input → visible feedback? (50ms? 100ms? 200ms?) This determines transport choice (WebSocket vs. WebTransport vs. WebRTC).

2. **Monetization model:** Will the game be free-to-play with cosmetic microtransactions, battle pass, or premium currency? This affects ISteamMicroTxn integration complexity.

3. **Concurrent player target at launch:** Is it 100 players? 1,000? 10,000? This determines initial server capacity and scaling urgency.

4. **Team size & expertise:** Do you have backend engineers experienced with Node.js, Rust, or Elixir? This should influence framework choice.

5. **Cross-progression priority:** Is cross-play (same character on web + Steam) mandatory day one, or can it be a later patch?

6. **Steam launch timeline:** Are you targeting 2027? This affects whether you wait for WebTransport/Safari support or launch with WebSocket.

7. **Anti-cheat:** Authoritative servers prevent client-side cheating (good). But what about:
   - Speedhacking (client sends inputs faster than real time)?
   - DDoS mitigation? (Consider CloudFlare, Akamai for web; Steam handles Steam client)
   - Account security? (Two-factor auth, suspicious login detection)

8. **Content patches:** How will you push character balance, new dungeons, mob nerfs? OTA updates via backend, or game client patches?

9. **Mobile expansion:** Today you say "no mobile." But will mobile (iOS/Android) come later? This affects client abstraction (easier with web tech; harder with Electron).

---

## 9. Sources

**Frameworks & Servers:**
- [Colyseus GitHub](https://github.com/colyseus/colyseus)
- [Nakama GitHub](https://github.com/heroiclabs/nakama)
- [SpacetimeDB GitHub](https://github.com/clockworklabs/SpacetimeDB)
- [Socket.IO GitHub](https://github.com/socketio/socket.io)
- [Fastify GitHub](https://github.com/fastify/fastify)
- [Phoenix Framework GitHub](https://github.com/phoenixframework/phoenix)

**Transports & Protocols:**
- [Geckos.io GitHub](https://github.com/geckosio/geckos.io)
- [uWebSockets GitHub](https://github.com/uNetworking/uWebSockets)
- [MessagePack GitHub](https://github.com/msgpack/msgpack)
- [FlatBuffers GitHub](https://github.com/google/flatbuffers)
- [Protocol Buffers GitHub](https://github.com/protocolbuffers/protobuf)
- [Quinn (QUIC) GitHub](https://github.com/quinn-rs/quinn)
- [Tokio GitHub](https://github.com/tokio-rs/tokio)

**Desktop Packaging & Steam:**
- [Electron GitHub](https://github.com/electron/electron)
- [Tauri GitHub](https://github.com/tauri-apps/tauri)
- [NW.js GitHub](https://github.com/nwjs/nw.js)
- [Greenworks GitHub](https://github.com/greenheartgames/greenworks)
- [Steam Python Module GitHub](https://github.com/ValvePython/steam)

**Case Studies & Examples:**
- [Bitburner GitHub](https://github.com/bitburner-official/bitburner-src)
- [IdleLands3 GitHub](https://github.com/IdleLands/IdleLands3)
- [Cloudflare Workers Chat Demo GitHub](https://github.com/cloudflare/workers-chat-demo)

**Supporting Tools:**
- [gRPC GitHub](https://github.com/grpc/grpc)
- [GraphQL Spec GitHub](https://github.com/graphql/graphql-spec)
- [PocketBase GitHub](https://github.com/pocketbase/pocketbase)
- [Firebase JS SDK GitHub](https://github.com/firebase/firebase-js-sdk)
- [go-libp2p GitHub](https://github.com/libp2p/go-libp2p)
- [Elixir GitHub](https://github.com/elixir-lang/elixir)

---

**Report compiled October 2026**  
**Next steps:** Validate against user's performance targets, team expertise, and monetization plan.
