# Konyha Tervező MVP – Telepítési útmutató

## Előfeltételek
- **Node.js** (v18 vagy újabb): https://nodejs.org/en/download

---

## Telepítés és indítás (Windows)

1. **Töltsd le a repót** ZIP-ként: zöld `Code` gomb → `Download ZIP`

2. **Csomagold ki** egy mappába, pl.: `C:\KonyhaTervezo\`

3. **Nyiss Parancssort (CMD)** abban a mappában:
   - Jobb klikk a mappán → "Megnyitás a Terminálban"

4. **Telepítsd a függőségeket** (csak egyszer):
   ```
   npm install
   ```

5. **Indítsd el:**
   ```
   npm start
   ```

6. **Böngészőben:**
   ```
   http://localhost:3000
   ```

---

## Funkciók (MVP Fázis 1)
- ✅ 4 konyhasablon (egyenes, L, U, szigetes)
- ✅ 5 szekrénytípus (alsó, felső, magas, fiókos, sarok)
- ✅ 3D WebGL nézet (Three.js)
- ✅ Ajtónyitás animáció
- ✅ Polcok 3D-ben
- ✅ 10 anyag/szín
- ✅ Tulajdonságok panel
- ✅ Árkalkuláció + darabjegyzék
- ✅ SQLite adatbázis mentés/betöltés
- ✅ Több projekt kezelése
