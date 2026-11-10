## 1. Executive Summary

**Objective.** Use the QSE CLI (IBM Quantum Safe Explorer, `app.version=2.3.1.0`, `build.version=202605.00095`) to find cryptographic algorithms, libraries, APIs and dependencies in the repository that may be vulnerable to future quantum attacks. Then assess them and recommend remediation.

**Repository analyzed.** https://github.com/SunilManika/crypto-inventory-demo, branch `main`, commit `bcc625a16b726f0c249a836909e20a6b4bd58b18`. Execution ID `c0d229f4-c3a5-43cd-9712-169f703eda90`. The checkout was read in place at `<workspace>/repo`.

**Scope.** 19 Java source files and 1,712 active lines of code, as reported by QSE. QSE supports only source and class-file analysis. Configuration files, certificates, `pom.xml`, `Dockerfile` and `docker/openssl.cnf` were not scanned by QSE. I read some of them by hand (see §2).

**Overall outcome.** QSE reported `globalQSafeComplianceStatus: false`. This is the result of the final (second) scan, which resolved all dependency classes (see §2 for the two runs).
- QSE found 48 crypto assets and produced a CycloneDX 1.6 CBOM with 49 cryptographic-asset components.
- 13 assets are labelled "Not Quantum Safe". All are RSA, ECDSA or ECDH (RSA key generation, encrypt/decrypt and sign/verify; ECDSA sign/verify; ECDH key agreement).
- 2 EC key-generation assets, 3 JJWT key assets and 3 `SecureRandom.nextBytes` assets (8 in total) are labelled "Unknown".
- 22 symmetric or hash assets are labelled "Not Applicable". QSE only categorizes asymmetric algorithms for quantum safety.
- 5 `SSLContext.getInstance("TLS")` assets have no compliance label.

**Key findings (from QSE output).**
- **RSA, 10 findings.** RSA-1024 and RSA-2048 are used for key generation, encryption and signatures. The RSA-1024 findings also carry CWE-326 (small key size). The RSA encrypt/decrypt findings also carry CWE-780 (no OAEP padding).
- **Elliptic curve, 5 findings.** EC / ECDSA / ECDH on `secp256r1` are flagged as non-quantum-resistant. QSE says the replacements "must be ML-KEM, ML-DSA, SLH-DSA".
- **Classically weak algorithms.** MD5 and SHA-1 are flagged CWE-327/328, and DES is flagged CWE-327. These are classical weaknesses, not quantum-specific.
- **JWT key handling.** Three JJWT key-handling assets (`JWTTokenExample.java` lines 28, 40 and 46) are flagged CWE-338. QSE traces the key material to `String.trim`, not `SecureRandom`.
- **Crypto-agility.** QSE flagged 88 low-severity crypto-agility anti-patterns, such as hardcoded algorithm names, key lengths and protocol names.

QSE issued 15 "non-quantum-resistant public-key algorithm" (CWE-327) findings: RSA 10, EC 2, ECDSA 2, ECDH 1.

## 2. Repository Analysis

**Languages and technologies.**
- Java 17 Maven project (`pom.xml`, `maven.compiler.source/target` = 17), group `com.example`, artifact `crypto-inventory-demo` version 1.0.0.
- `Dockerfile` using `maven:3.9-eclipse-temurin-17` and `eclipse-temurin:17-jre`.
- Config, certificates and secrets directories.
- The source tree is `src/main/java/com/demo/{app,asymmetric,certificates,crypto,hashing,jwt,signatures,ssh,ssl,symmetric,tls}`. It has 19 `.java` files, all of which QSE scanned.

**Cryptographic components (files read and QSE evidence).**
- Hashing: `MD5Example`, `SHA1Example`, `SHA256Example`.
- Symmetric: `AES128Example`, `AES256Example` (AES/GCM), `DESExample` (DES/CBC/PKCS5).
- Asymmetric: `RSA1024Example`, `RSA2048Example`, `ECExample` (EC/ECDH).
- Signatures: `RSASignatureExample`, `ECDSASignatureExample`.
- JWT: `JWTTokenExample`, which uses JJWT `Keys.secretKeyFor(SignatureAlgorithm.HS256)` and `Keys.hmacShaKeyFor`. The source prints "HS256 (HMAC with SHA-256)".
- SSH: `SSHConnectionExample`, which uses JSch with `StrictHostKeyChecking=no` (demo comment in source).
- TLS/SSL: `SSLContextExample` and `TLSClientExample`, which use `SSLContext.getInstance("TLS")`.
- KeyStores: `KeyStoreExample` and `TrustStoreExample`. `KeyStoreExample.java` sets `keystoreType = "JKS"` and generates an RSA key pair at line 87. `SSLContextExample.java` also loads `KeyStore.getInstance("JKS")`.
- Certificates: `CertificateLoader` and `TrustStoreExample` use `CertificateFactory.getInstance("X.509")`.

**Dependencies analyzed (from `pom.xml`, read manually).** QSE has no manifest-level dependency scanner. It was only given these jars as class-resolution input.

| Dependency | Version in `pom.xml` |
|---|---|
| `org.bouncycastle:bcprov-jdk18on`, `bcpkix-jdk18on` | 1.78 |
| `io.jsonwebtoken:jjwt-api` / `jjwt-impl` / `jjwt-jackson` | 0.12.5 |
| `com.jcraft:jsch` | 0.1.55 |
| `org.slf4j:slf4j-api` | 2.0.12 |
| `ch.qos.logback:logback-classic` | 1.5.3 |

No Bouncy Castle `import`s were found in the source by my `grep`. The Bouncy Castle dependencies are declared but QSE reported no assets attributed to them. All QSE assets are attributed to `library: JCA`.

**Non-source files read manually (not scanned by QSE).**
- `config/application.properties` sets `crypto.default.algorithm=AES`, `crypto.default.keysize=256`, `crypto.default.mode=GCM`, `keystore.type=JKS`, `truststore.type=JKS`, `ssl.protocol=TLS` and `ssl.enabled.protocols=TLSv1.2,TLSv1.3`.
- `docker/openssl.cnf` has `default_bits = 2048`, `default_md = sha256`, and usage-example commands that use `rsa:2048` and `rsa:4096`.
- The repository contains `certificates/rootCA.pem`, `certificates/server.crt`, `certificates/server.key` (its first line is `a PEM private-key header`), `secrets/secret.properties` and `jwt/jwt-secret.txt`. I did not reproduce any secret or key values here.
- I tried to inspect the certificates with `openssl x509` and `keytool -printcert`. Both failed to parse them. **The public-key algorithm, key size and signature algorithm of the committed certificates could not be determined.**
- `keys/` and `keystore/` contain only `.gitkeep`.

**Scan runs and limitations.**
1. **Run 1.** Input was the repository checkout, with `-cf <repo>/target/classes` and `-da`. Output is in `qs_scan_result/`. It produced 43 assets and an issue summary of 6 issues:
   - Missing dependency classes `io.jsonwebtoken.JwtException` and `com.jcraft.jsch.Session` (in `Main.java`, `JWTTokenExample.java`, `SSHConnectionExample.java`).
   - `JWTTokenExample` and `SSHConnectionExample` graphs failed to build. `log/scan-errors.log` shows that `com.demo.jwt.JWTTokenExample` was found both in `target/classes` and in `target/crypto-inventory-demo-1.0.0.jar` ("several jars that implement it"). This is why the JWT and SSH-related findings were incomplete in Run 1.
2. **Run 2.** I made a temporary copy of `src/` to `/tmp/qse-src` and copied `target/classes` and the dependency jars into `/tmp/qse-cf`. I took the jars from the local `~/.m2` cache, at the same versions that `pom.xml` declares: JJWT 0.12.5, JSch 0.1.55, and Bouncy Castle 1.78 (bcprov and bcpkix). The `-cf` value was `/tmp/qse-cf/classes;/tmp/qse-cf/lib`, again with `-da`. The repository checkout was not modified. Output is in `qs_scan_result_run2/`. The issue summary is empty (`"issues":[]`), 48 assets were found, and 19 files were scanned.
3. **Not covered.**
   - Transitive dependencies of the listed libraries.
   - Runtime behavior, such as JVM default TLS cipher suites and which JCE providers are present at runtime.
   - TLS and SSH negotiation. QSE flagged only the hardcoded protocol name "TLS". It did not enumerate the negotiated key exchange or cipher suites.
   - `Main.java` produced no crypto assets of its own.
   - `SSHConnectionExample.java` (JSch) produced no crypto assets in Run 2. I did not find SSH key-exchange, host-key or signature algorithm assets in the Run 2 asset list.
   - Data-analytics (`-da`) usage output was not found as a separate artifact. The only `-da`-related artifacts are inside the findings JSON.
   - QSE did not output any numeric risk scores or timeline estimates beyond the labels quoted in §3.

## 3. Quantum-Safe Assessment

All counts below come from `qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_findings_java.json` (48 assets) unless noted.

### 3.1 Cryptographic algorithms identified

| Algorithm / API | Assets (QSE) | Files and lines |
|---|---|---|
| RSA (1024 and 2048) via `KeyPairGenerator`, `Cipher`, `Signature` | 10 | `RSA1024Example.java` L23, 29, 36; `RSA2048Example.java` L22, 28, 35; `KeyStoreExample.java` L87; `RSASignatureExample.java` L22, 29, 38 |
| EC (secp256r1) keygen | 2 | `ECExample.java` L28; `ECDSASignatureExample.java` L24 |
| ECDSA sign / verify | 2 | `ECDSASignatureExample.java` L31, 40 |
| ECDH key agreement | 1 | `ECExample.java` L35 |
| AES-128/256 GCM (Cipher + KeyGenerator) | 6 | `AES128Example.java`, `AES256Example.java` |
| DES (CBC / PKCS5, 56-bit) | 3 | `DESExample.java` L27, 41, 50 |
| MD5 | 2 | `MD5Example.java` L19, 25 |
| SHA-1 ("SHA") | 2 | `SHA1Example.java` L17, 23 |
| SHA-256 | 3 | `SHA256Example.java` L17, 23, 38 |
| SHA-256 associated with sign / verify operations | 4 | `ECDSASignatureExample.java` L31, 40; `RSASignatureExample.java` L29, 38 |
| JJWT (HMAC / SHA-2 based) key creation and verification | 5 | `JWTTokenExample.java` L23, 28, 40, 46 |
| `SecureRandom.nextBytes` | 3 | `AES128Example.java` L33; `AES256Example.java` L34; `DESExample.java` L32 |
| `SSLContext.getInstance("TLS")` | 5 | `SSLContextExample.java` L43, 50; `TLSClientExample.java` L19, 29, 88 |

### 3.2 Potentially quantum-vulnerable implementations (QSE classification)

QSE labelled **13 assets "Not Quantum Safe"**. Its message is "The asset has an asymmetric primitive and does not match with the Quantum Safe whitelists of OIDs and algorithms". These are:
- RSA key generation: `RSA1024Example.java:23`, `RSA2048Example.java:22`, `KeyStoreExample.java:87`, `RSASignatureExample.java:22`.
- RSA encrypt and decrypt: `RSA1024Example.java:29` and `:36`, `RSA2048Example.java:28` and `:35`.
- RSA sign and verify: `RSASignatureExample.java:29` and `:38`.
- ECDSA sign and verify: `ECDSASignatureExample.java:31` and `:40`.
- ECDH key agreement: `ECExample.java:35`.

Two EC key-generation assets (`ECExample.java:28`, `ECDSASignatureExample.java:24`) have QSE label "Unknown". The reason given is that the asset primitive was not set. They still carry the CWE-327 "non-quantum-resistant public-key algorithm: EC" finding.

QSE did not label symmetric or hash assets for quantum safety. These show "Not Applicable" ("we only categorize asymmetric algorithms"). I make no claim about AES-128/256 or SHA-256 post-quantum strength based on QSE output.

### 3.3 Findings with evidence (severity values are QSE's `vulnerabilityScore`)

| Classification | QSE severity | Count | Summary |
|---|---|---|---|
| CWE-327 | high | 22 total | 15 "Use of non-quantum-resistant public-key algorithms (must be ML-KEM, ML-DSA, SLH-DSA)" (RSA ×10, EC ×2, ECDSA ×2, ECDH ×1). The other 7 are "broken or risky cryptographic algorithm": MD5 ×2, SHA ×2, DES ×3. |
| CWE-328 | high | 4 | "Use of weak hash algorithm": MD5 (`MD5Example.java` L19, 25) and SHA (`SHA1Example.java` L17, 23). |
| CWE-326 | high | 3 | "Use of small key size: 1024" (`RSA1024Example.java` L23, 29, 36). |
| CWE-780 | high | 4 | RSA used without the recommended OAEP padding (`RSA1024Example.java` L29, 36; `RSA2048Example.java` L28, 35). |
| CWE-338 | high | 3 | "Use of cryptographically weak pseudo-random number generator" with `java.lang.String.trim for key` (`JWTTokenExample.java` L28, 40, 46). Only a `trim` call on a string key is reported, and the finding says to use `SecureRandom` instead. I did not manually trace the code path. |
| CWE-759 | low | 11 | "Use of one-way hash without a salt" (hash assets in `MD5Example`, `SHA1Example`, `SHA256Example` and sign/verify-associated SHA-2 assets). |
| Crypto-agility anti-pattern | low | 88 | Hardcoded algorithm choice (52), key length (21), IV length (6), protocol "TLS" (5), tag length (4). |

Also reported by QSE: FIPS 140-3 L1 compliance labels. For example, the RSA-1024 assets are "FIPS140-3-L1 non-compliant". The RSA-2048 key generation and EC key generation assets are "FIPS140-3-L1 capable" with `isUnCompliant: true` and a message. I did not analyze the full wording of these messages beyond the labels.

### 3.4 Post-quantum opportunities

Mapping uses the targets named in QSE's own message ("ML-KEM, ML-DSA, SLH-DSA"). The migration pairings are my interpretation and are not QSE output.

| Current use (QSE-detected) | Post-quantum candidate |
|---|---|
| RSA / ECDH key establishment and RSA encryption | ML-KEM (FIPS 203) |
| RSA / ECDSA signatures (`RSASignatureExample`, `ECDSASignatureExample`) | ML-DSA (FIPS 204) or SLH-DSA (FIPS 205) |
| RSA / EC keys stored in KeyStores (`KeyStoreExample`) | Hybrid or PQC key types once the JCE provider and keystore format support them |
| TLS via `SSLContext.getInstance("TLS")` | Hybrid key exchange, depending on JDK/provider support |
| SSH via JSch 0.1.55 | Replace or upgrade the SSH library. This is my observation, since QSE produced no JSch assets in Run 2. |

Neither QSE nor my review identified any post-quantum algorithm already in use in this repository.

## 4. Recommendations

**Prioritized next steps.**

1. **Remove classically broken primitives first (CWE-326/327/328/780).** These findings are high severity in QSE and are independent of quantum timelines.
   - Remove or replace `RSA1024Example` (RSA-1024, no OAEP) and `DESExample`.
   - Replace MD5 and SHA-1 usage (`MD5Example`, `SHA1Example`) with SHA-256 or stronger. If these files are demonstration only, keep them clearly marked and out of production paths.
   - Use OAEP padding for any remaining RSA encryption (`RSA1024Example`, `RSA2048Example`).
2. **Fix JWT key handling (CWE-338, `JWTTokenExample.java` L28, 40, 46).** Generate HMAC keys with `SecureRandom` or `Keys.secretKeyFor(...)`. Do not derive them from a stored or trimmed string. Keep key material outside the repository.
3. **Plan migration of the 13 "Not Quantum Safe" RSA/ECDSA/ECDH assets.**
   - Build an inventory and prioritize long-lived confidentiality uses: RSA encryption, ECDH and key exchange.
   - Prioritize signatures that must remain valid long term.
   - Target ML-KEM for key establishment and ML-DSA or SLH-DSA for signatures. Consider hybrid classical + PQC modes during the transition. Confirm provider support first. Bouncy Castle at the pinned version may offer PQC algorithms, but I did not verify that against the library, and QSE does not report it.
4. **Improve crypto-agility (88 low findings).** Move hardcoded algorithm names, key lengths and protocol names into configuration. `config/application.properties` already has `crypto.default.*` and `ssl.*` keys, but the code hardcodes values. Wrap algorithm selection in a single abstraction so a PQC algorithm can be swapped in with a configuration change.
5. **Dependencies to review.**
   - `jsch` 0.1.55 is an old version. I have not verified its supported algorithms, so check whether a maintained fork is needed for modern key exchange and host-key algorithms.
   - `bcprov-jdk18on` / `bcpkix-jdk18on` 1.78 and the other pinned versions should be compared against current releases for security fixes and PQC support. I did not run a vulnerability database check.
   - Declared Bouncy Castle dependencies are unused according to my `grep` of the source and QSE's JCA-only attribution. Remove them if they are not needed, or use them deliberately for PQC.
6. **Switch keystores and trust stores from JKS to PKCS12.** `keystore.type=JKS` and `truststore.type=JKS` are used in `config/application.properties`, `KeyStoreExample.java` and `SSLContextExample.java`. The repository's own code prints "Use PKCS12 format for new KeyStores". JKS is also a legacy format.
7. **Review committed key and secret files.** The repository contains `certificates/server.key`, `secrets/secret.properties` and `jwt/jwt-secret.txt`. I did not verify whether they are real or sample values, but they should not be in version control. Rotate them if they are real. Parse the certificates with a working tool to determine their key algorithm and signature algorithm, since I could not do so.
8. **Enforce TLS and SSH policy.** QSE flagged only the hardcoded "TLS" protocol choice. The properties file lists `TLSv1.2,TLSv1.3`. Confirm at runtime which protocols and cipher suites are actually enabled. `SSHConnectionExample` sets `StrictHostKeyChecking=no` (the source says this is demo-only).
9. **Fix the scan setup.** For future QSE runs, supply a `-cf` path that contains `target/classes` and the dependency jars, without also including the project's own packaged jar. Otherwise QSE reports "several jars that implement it". Optionally add QSE to CI so the 13 "Not Quantum Safe" assets are tracked.

## 5. Execution Artifacts

All paths are under `<bob-workspace>` unless an absolute path is shown.

**Run 1** (`-cf <repo>/target/classes`, 43 assets, 6 issues):
- `qs_scan_result/qs_explorer_result/quantum_safe_cryptography_analysis_findings_java.json`
- `qs_scan_result/qs_explorer_result/quantum_safe_cryptography_analysis_cbom.json` (CycloneDX CBOM)
- `qs_scan_result/qs_explorer_result/quantum_safe_cryptography_analysis_issue_summary.json`
- `qs_scan_result/qs_scan_result.zip`. It contains `metrics/metrics-summary.json`, `slices/cryptoData.json`, `log/scan.log`, `log/scan-debug.log` and `log/scan-errors.log`. The `java/02_graph_model/` directory is empty.

**Run 2** (primary, complete resolution of dependencies, 48 assets, no issues):
- `qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_findings_java.json`
- `qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_cbom.json` (CycloneDX 1.6, 49 components)
- `qs_scan_result_run2/qs_explorer_result/quantum_safe_cryptography_analysis_issue_summary.json`
- `qs_scan_result_run2/qs_scan_result.zip` (metrics, slices and logs for Run 2; I did not inspect its contents)

**Helper (temporary) files created by me outside the workspace:**
- `/tmp/qse-src/` — copy of the repository `src/` directory used as the Run 2 scan input.
- `/tmp/qse-cf/classes` and `/tmp/qse-cf/lib` — copies of `target/classes` and the dependency jars used as the Run 2 class path.
- `/tmp/qsx/` — an extraction of `qs_scan_result.zip` that I used to read the Run 1 logs.

**Report:**
- `qse-e2e-report.md`

## 6. Conclusion

**Overall assessment.** QSE reports the application as non-compliant (`globalQSafeComplianceStatus: false`). All of its public-key cryptography is quantum-vulnerable: RSA (1024 and 2048), EC / ECDSA / ECDH on secp256r1. The repository also uses classically broken primitives (MD5, SHA-1, DES, RSA-1024, RSA without OAEP). It contains no post-quantum algorithms. The project is a demonstration inventory of crypto usage, so these findings are expected for its purpose. They show what a real application would need to migrate.

**Key takeaways.**
- 13 assets are labelled "Not Quantum Safe" by QSE, and 2 further EC key-generation assets are "Unknown" but also flagged CWE-327.
- Fixing the classical weaknesses (CWE-326/327/328/780/338) is the fastest risk reduction.
- The hardcoded algorithm, key length and protocol choices (88 findings) are the main obstacle to a quick PQC migration.
- Not covered: the committed certificates (could not be parsed), the transitive dependencies, JSch/SSH algorithm negotiation, and the runtime TLS configuration.

**Next steps.**
1. Remove or replace the weak primitives and fix the JWT key handling.
2. Introduce configuration-driven algorithm selection.
3. Pilot ML-KEM / ML-DSA (or hybrid) for key establishment and signatures where the libraries support them.
4. Re-run QSE after each change and compare findings with `qs_scan_result_run2`.
