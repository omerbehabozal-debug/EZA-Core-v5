# Mirror Journey — Phase 2 Production Closure

Status: **implemented (window identity + parent modes + Q20 guard + CAS)**  
Depends on: Phase 2 deterministic windows  
Phase 3 Scoped D2: **not started**

## Closure items

1. Publish request carries explicit window identity (`windowIndex` / `windowStart` / `windowEnd`) + step `sourceOrder` / source message ids
2. Backend rejects mismatches with `journey_window_contract_invalid`
3. DB persists window fields on `mirror_network_nodes` and `source_order` + hashes on steps
4. Same-conversation owner continuation does **not** require `lineageProofToken`
5. External/cross-user parent still requires proof
6. Q21 blocked once the 20th eligible user question is accepted (even if A20 streams)
7. Journey window localStorage uses `stateVersion` CAS against silent multi-tab overwrite
8. Root `.github/workflows` is the only authoritative CI; nested `eza-v5/.github` documented unused
