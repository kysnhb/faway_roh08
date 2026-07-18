/* ============================================================
   피그 슬레이어즈 성장 계산기
   데이터: data/growth.json (BGDatabase 테이블 원본)
   공식 등급:  [확정] 테이블 직접  /  [검증] 데이터 정합성 확인  /  [가정] 모델링
   ============================================================ */
(function () {
  let D = null;
  const $ = id => document.getElementById(id);

  // ---------- 숫자 표기 (방치형 큰 수) ----------
  const UNITS = ["", "만", "억", "조", "경", "해", "자", "양", "구", "간", "정", "재", "극"];
  function fmt(n) {
    if (!isFinite(n)) return "∞";
    if (n === 0) return "0";
    if (n < 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    let i = 0, v = n;
    while (v >= 10000 && i < UNITS.length - 1) { v /= 10000; i++; }
    return v.toFixed(2).replace(/\.?0+$/, "") + UNITS[i];
  }
  const sec = s => !isFinite(s) ? "불가"
    : s < 60 ? s.toFixed(2) + "초"
    : s < 3600 ? (s / 60).toFixed(1) + "분"
    : s < 86400 ? (s / 3600).toFixed(1) + "시간"
    : (s / 86400).toFixed(1) + "일";

  // ---------- 성장 값 ----------
  // 스크린샷 실측으로 기존 공식(value + valueAdd×Σ)이 반증됨:
  //   공격력 Lv.5 실측 = 7 (레벨당 +1). 기존 공식은 600을 냄 → 폐기.
  // 교정: 구간(band)이 있는 스탯은 [기본값 + Σ구간AddValue]. 공격력은 실측 기울기(+1/Lv)와 일치.
  //   구간이 없는 스탯(치명타율/치명타공격력)은 [Value + ValueAdd×Lv] — 실측과 일치(0.2%/Lv).
  const DEFAULT = { Damage: 1, Health: 10, HealthRecovery: 1 };  // GROWTH_DEFAULT_*
  function growthValue(g, lv) {
    lv = Math.max(0, Math.min(lv, g.maxLevel));
    if (!g.bands || !g.bands.length) return g.value + g.valueAdd * lv;   // 치명타 계열 (검증됨)
    let total = 0, done = 0;
    for (const b of g.bands) {
      if (lv <= done) break;
      const n = Math.min(lv, b.level) - done;
      if (n > 0) { total += n * b.addValue; done += n; }
    }
    if (lv > done) total += (lv - done) * g.bands[g.bands.length - 1].addValue;
    return (DEFAULT[g.stat] || 0) + total;   // 공격력 실측 캘리브 (체력 계열은 오차 가능 — 미확정)
  }

  // ---------- [확정] 로열 포스 ----------
  const forceValue = (x, lv) =>
    x.defaultValue + Math.max(0, Math.min(lv, x.maxLevel)) * x.valueMul / (x.valueDiv || 1);

  function forceCostAt(x, lv) {
    let mul = 1;
    for (const b of D.forceBands) if (lv >= b.level) mul = b.costMul;
    return (x.cost + x.costAdd * lv) * mul;
  }
  function forceTotalCost(x, a, b) {
    let t = 0;
    for (let l = a; l < Math.min(b, x.maxLevel); l++) t += forceCostAt(x, l);
    return t;
  }

  const G = n => D.growth.find(g => g.name === n);
  const Gs = s => D.growth.find(g => g.stat === s);
  const F = n => D.force.find(f => f.name === n);

  // ---------- [가정] 치명타 5중첩 ----------
  function critExpected(L) {
    const c = [], d = [];
    for (let n = 1; n <= 5; n++) {
      c.push(Math.min(1, growthValue(Gs("CriticalChance" + n), L["cc" + n] || 0) / 100));
      d.push(growthValue(Gs("CriticalDamageRate" + n), L["cd" + n] || 0) / 100);
    }
    let e = (1 - c[0]) * 1, reach = 1;
    for (let n = 0; n < 5; n++) {
      reach *= c[n];
      const nxt = n + 1 < 5 ? c[n + 1] : 0;
      e += reach * (1 - nxt) * d[n];
    }
    return { e, c, d };
  }

  function read() {
    const v = id => parseFloat($(id).value) || 0;
    return {
      growthDamage: v("gDamage"),
      cc1: v("cc1"), cd1: v("cd1"), cc2: v("cc2"), cd2: v("cd2"),
      cc3: v("cc3"), cd3: v("cd3"), cc4: v("cc4"), cd4: v("cd4"),
      cc5: v("cc5"), cd5: v("cd5"),
      forceDamageRate: v("fDamage"), forceAttackSpeed: v("fSpeed"),
      forceCritDmg: v("fCrit"), forceGold: v("fGold"), forceExp: v("fExp"),
      equipRate: v("eqRate"), passiveRate: v("pasRate"),
      blessDamage: v("blDamage"), blessGold: v("blGold"), blessExp: v("blExp"),
      atkSpeedRate: v("aspRate"),
    };
  }

  function calc(B) {
    // [가정] 타당 데미지 = (기본 + 성장) × (1 + ΣDamageRate%) × (1 + FinalDamageRate%)
    const base = D.const.GROWTH_DEFAULT_Damage || 1;
    const flat = base + growthValue(G("공격력"), B.growthDamage);
    const rate = forceValue(F("추가 공격력 증가"), B.forceDamageRate) + B.equipRate + B.passiveRate;
    const finalRate = B.blessDamage;
    const dmg = flat * (1 + rate / 100) * (1 + finalRate / 100);

    const crit = critExpected(B);
    // [가정] 초당 타수 = (1000 + 포스공속)/1000 × (1 + 공속%)
    const aps = (1000 + forceValue(F("공격 속도 증가"), B.forceAttackSpeed)) / 1000
      * (1 + B.atkSpeedRate / 100);
    const hit = dmg * crit.e;
    const goldB = 1 + forceValue(F("골드 보너스 증가"), B.forceGold) / 100 + B.blessGold / 100;
    const expB = 1 + forceValue(F("경험치 보너스 증가"), B.forceExp) / 100 + B.blessExp / 100;
    return { flat, rate, finalRate, dmg, crit, aps, hit, dps: hit * aps, goldB, expB };
  }

  function stages(R) {
    const bossTime = D.const.StageBossTime || 60;
    return D.stage.map(s => {
      const hits = R.hit > 0 ? Math.max(1, Math.ceil(s.health / R.hit)) : Infinity;
      const killSec = hits / R.aps;
      const bossHp = s.bossValue ? s.health * s.bossValue : s.health;
      const bossSec = Math.max(1, Math.ceil(bossHp / R.hit)) / R.aps;
      return {
        s, hits, killSec, bossSec,
        clearable: bossSec <= bossTime,
        goldH: s.gold * R.goldB * 3600 / killSec,
        expH: s.exp * R.expB * 3600 / killSec,
        clearSec: killSec * s.completeCount,
      };
    });
  }

  function render() {
    const B = read(), R = calc(B), ST = stages(R);
    const ok = ST.filter(x => x.clearable);
    const best = ok.length ? ok.reduce((a, b) => a.goldH > b.goldH ? a : b) : null;
    const bestE = ok.length ? ok.reduce((a, b) => a.expH > b.expH ? a : b) : null;

    $("oDmg").textContent = fmt(R.dmg);
    $("oCrit").textContent = "×" + R.crit.e.toFixed(2);
    $("oAps").textContent = R.aps.toFixed(2) + "타";
    $("oDps").textContent = fmt(R.dps);
    $("oClear").textContent = ok.length + " / 50";
    $("oBest").textContent = best ? best.s.name : "없음";
    $("oGoldH").textContent = best ? fmt(best.goldH) : "-";
    $("oExpH").textContent = bestE ? fmt(bestE.expH) : "-";

    $("oFlat").textContent = fmt(R.flat);
    $("oRate").textContent = "+" + fmt(R.rate) + "%";
    $("oFinal").textContent = "+" + fmt(R.finalRate) + "%";
    $("oGoldB").textContent = "×" + R.goldB.toFixed(2);
    $("oExpB").textContent = "×" + R.expB.toFixed(2);

    // 치명타 내역
    $("critBody").innerHTML = R.crit.c.map((c, i) =>
      `<tr><td>${i + 1}단</td><td class="num">${(c * 100).toFixed(1)}%</td>
       <td class="num">×${R.crit.d[i].toFixed(2)}</td></tr>`).join("");

    // 스테이지 표
    $("stageBody").innerHTML = ST.map(x => `<tr${x.clearable ? "" : ' style="opacity:.42"'}>
      <td>${x.s.name}</td>
      <td><span class="chip ${x.s.diff === "Hard" ? "ruby" : "jade"}">${x.s.diff}</span></td>
      <td>${x.s.startLv}–${x.s.endLv}</td>
      <td class="num">${fmt(x.s.health)}</td>
      <td class="num">${isFinite(x.hits) ? x.hits.toLocaleString() : "∞"}</td>
      <td class="num">${sec(x.killSec)}</td>
      <td class="num">${sec(x.clearSec)}</td>
      <td class="num">${fmt(x.goldH)}</td>
      <td class="num">${fmt(x.expH)}</td>
      <td>${x.clearable ? '<span class="chip jade">가능</span>' : '<span class="chip">불가</span>'}</td>
    </tr>`).join("");

    // 레벨업
    const eph = bestE ? bestE.expH : 0;
    const pairs = [[1, 10], [10, 50], [50, 100], [100, 150], [150, 200], [200, 250], [250, 300]];
    $("lvBody").innerHTML = pairs.map(([a, b]) => {
      let need = 0;
      for (let i = a - 1; i < Math.min(b - 1, D.royalLevel.length); i++) need += D.royalLevel[i];
      const s = eph > 0 ? need / eph * 3600 : Infinity;
      return `<tr><td>Lv ${a} → ${b}</td><td class="num">${fmt(need)}</td>
              <td class="num">${sec(s)}</td></tr>`;
    }).join("");

    // 포스 비용 (확정)
    $("forceBody").innerHTML = D.force.map(x => {
      const lv = B["force" + ({ "추가 공격력 증가": "DamageRate", "공격 속도 증가": "AttackSpeed",
        "골드 보너스 증가": "Gold", "경험치 보너스 증가": "Exp" }[x.name] || "")] || 0;
      const cur = forceValue(x, lv);
      return `<tr><td>${x.name}</td><td>${x.maxLevel}</td>
        <td class="num">${lv || "-"}</td>
        <td class="num">${fmt(cur)}${x.isPercent ? "%" : ""}</td>
        <td class="num">${fmt(forceCostAt(x, lv))}</td>
        <td class="num">${fmt(forceTotalCost(x, 0, x.maxLevel))}</td></tr>`;
    }).join("");
  }

  function preset(name) {
    const P = {
      start: { gDamage: 0 },
      early: { gDamage: 200, fDamage: 20, fSpeed: 50, cc1: 100, cd1: 100 },
      mid: { gDamage: 5000, fDamage: 300, fSpeed: 400, fGold: 200, fExp: 200,
             cc1: 500, cd1: 500, cc2: 300, cd2: 300 },
      late: { gDamage: 40000, fDamage: 600, fSpeed: 900, fGold: 500, fExp: 500,
              cc1: 500, cd1: 500, cc2: 1000, cd2: 1000, cc3: 1000, cd3: 1000 },
      max: { gDamage: 150000, fDamage: 600, fSpeed: 900, fCrit: 900, fGold: 500, fExp: 500,
             cc1: 500, cd1: 500, cc2: 1000, cd2: 1000, cc3: 1000, cd3: 1000,
             cc4: 1000, cd4: 1000, cc5: 1000, cd5: 1000,
             eqRate: 3000, pasRate: 4000, blDamage: 105, blGold: 105, blExp: 105, aspRate: 30 },
    }[name];
    document.querySelectorAll("#calcForm input").forEach(i => { i.value = 0; });
    for (const k in P) if ($(k)) $(k).value = P[k];
    render();
  }

  // 데이터는 페이지에 직접 심는다(window.GROWTH_DATA).
  // fetch를 쓰면 file:// 로 열었을 때 CORS에 막혀 계산기가 죽는다 — 리포트는 더블클릭으로 열린다.
  function boot() {
    D = window.GROWTH_DATA;
    if (!D) {
      const el = $("calcErr");
      if (el) el.textContent = "성장 데이터를 찾을 수 없습니다 (window.GROWTH_DATA 누락).";
      return;
    }
    document.querySelectorAll("#calcForm input").forEach(i =>
      i.addEventListener("input", render));
    document.querySelectorAll("[data-preset]").forEach(b =>
      b.addEventListener("click", () => preset(b.dataset.preset)));
    preset("mid");
  }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
