(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;
  const gardenPlotCount = 14;
  const gardenColumns = 7;
  const levels = [
    { name: "Maplewood Park", short: "PARK", scene: "park", trash: 8, time: 95, obstacles: 0, colors: ["#d7ecc9", "#c5e1b4", "#86bd78"], intro: "Find the seed chest, plant a seed, and water your garden with drip irrigation." },
    { name: "Sunnyshore Beach", short: "BEACH", scene: "beach", trash: 10, time: 90, obstacles: 7, colors: ["#f1dfaa", "#ead59a", "#77c8c0"], intro: "The tide brought in a few things. Let's send them back to the right place." },
    { name: "Fernhill Forest", short: "FOREST", scene: "forest", trash: 12, time: 85, obstacles: 10, colors: ["#c2daa8", "#abc991", "#5a966b"], intro: "The forest floor is counting on you. Watch your step and sort with care." },
    { name: "Littlehaven City", short: "CITY", scene: "city", trash: 14, time: 80, obstacles: 12, colors: ["#dedcb9", "#d0d0a6", "#75a9a0"], intro: "One last big clean. Let's leave the city a brighter place." }
  ];
  const trashTypes = [
    { kind: "Paper", emoji: "📄", color: "#438ad0", bin: "BLUE" },
    { kind: "Plastic", emoji: "🧴", color: "#e6bd4b", bin: "YELLOW" },
    { kind: "Glass", emoji: "🍾", color: "#58a976", bin: "GREEN" },
    { kind: "Metal", emoji: "🥫", color: "#df655c", bin: "RED" }
  ];
  const binPalette = [
    { label: "PAPER", color: "#498dcc", dark: "#3274b1" },
    { label: "PLASTIC", color: "#e8ba47", dark: "#cf9c2b" },
    { label: "GLASS", color: "#62a977", dark: "#488c5d" },
    { label: "METAL", color: "#df6960", dark: "#c7524b" }
  ];
  const el = (id) => document.getElementById(id);
  const ui = {
    home: el("home-screen"), how: el("how-screen"), settings: el("settings-screen"),
    pause: el("pause-screen"), result: el("result-screen"), settingsEntry: el("settings-entry"),
    hud: el("hud"), levelTitle: el("level-title"), levelKicker: el("level-kicker"),
    areaName: el("area-name"), areaLabel: el("area-label"), levelProgress: el("level-progress"),
    inventory: el("inventory"), seedCounter: el("seed-counter"), seedCount: el("seed-count"),
    levelChip: el("level-chip"), objectiveToast: el("objective-toast"),
    progressFill: el("progress-fill"), progressCount: el("progress-count"),
    score: el("score"), timer: el("timer"), health: el("health"),
    inventoryIcon: el("inventory-icon"), inventoryName: el("inventory-name"),
    levelNumber: el("level-number"), levelShortName: el("level-short-name"),
    levelDots: el("level-dots"), bestScore: el("best-score"),
    soundButton: el("sound-button"), soundIcon: el("sound-icon"), soundLabel: el("sound-label"),
    settingsSound: el("settings-sound"), motionToggle: el("motion-toggle")
  };
  let state = "menu";
  let levelIndex = 0;
  let score = 0;
  let bestScore = Number(localStorage.getItem("cleanEarthBest") || 0);
  let remainingTime = 0;
  let lastTime = 0;
  let elapsed = 0;
  let soundOn = true;
  let motionOn = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let audioContext = null;
  let musicInterval = 0;
  let musicStep = 0;
  let settingsReturnScreen = "menu";
  let player = { x: 600, y: 390, vx: 0, vy: 0, facing: 1, walk: 0, health: 3, invulnerable: 0, carried: null, carriedItem: null };
  let trash = [];
  let bins = [];
  let obstacles = [];
  let garden = null;
  let seedChest = null;
  let seedCount = 0;
  let particles = [];
  let keys = new Set();
  let touchMove = null;
  let toastTimer = 0;
  let areaAccent = 0;

  ui.bestScore.textContent = String(bestScore).padStart(4, "0");

  function setScreen(screen) {
    for (const [name, node] of Object.entries({ menu: ui.home, how: ui.how, settings: ui.settings, pause: ui.pause, result: ui.result })) {
      node.hidden = name !== screen;
    }
    ui.settingsEntry.hidden = screen !== "menu";
    ui.objectiveToast.hidden = true;
  }

  function updateHeader() {
    const level = levels[levelIndex];
    ui.levelTitle.textContent = state === "menu" ? "The world could use a hand." : level.name;
    ui.levelKicker.textContent = state === "menu" ? "YOUR LITTLE MISSION" : `YOUR MISSION · DAY ${String(levelIndex + 1).padStart(2, "0")}`;
    ui.areaName.textContent = level.name.toUpperCase();
    ui.levelNumber.textContent = String(levelIndex + 1).padStart(2, "0");
    ui.levelShortName.textContent = level.short;
    [...ui.levelDots.children].forEach((dot, i) => {
      dot.classList.toggle("active", i === levelIndex);
      dot.classList.toggle("complete", i < levelIndex);
    });
    ui.hud.hidden = state !== "playing" && state !== "paused";
    ui.levelProgress.hidden = state !== "playing" && state !== "paused";
    ui.inventory.hidden = state !== "playing" && state !== "paused";
    ui.seedCounter.hidden = (state !== "playing" && state !== "paused") || !seedChest;
    ui.levelChip.hidden = state !== "playing" && state !== "paused";
    ui.areaLabel.hidden = state === "playing" || state === "paused";
  }

  function startGame(index = 0) {
    if (index === 0) score = 0;
    levelIndex = index;
    loadLevel();
  }

  function loadLevel() {
    const level = levels[levelIndex];
    state = "playing";
    elapsed = 0;
    remainingTime = level.time;
    player = { x: 600, y: 390, vx: 0, vy: 0, facing: 1, walk: 0, health: 3, invulnerable: 0, carried: null, carriedItem: null };
    particles = [];
    keys.clear();
    bins = [];
    trash = [];
    obstacles = [];
    garden = null;
    seedChest = null;
    seedCount = 0;
    areaAccent = Math.random() * TAU;
    buildScene(level);
    setScreen("");
    updateHeader();
    updateHud();
    showToast(level.intro, 3000);
    playTone(480, 0.11, "sine", 0.035);
    startMusic();
  }

  function buildScene(level) {
    const spots = level.scene === "beach"
      ? [[160,150],[385,205],[780,148],[1010,180]]
      : level.scene === "city"
        ? [[160,156],[1040,155],[160,565],[1040,565]]
        : [[145,155],[1055,155],[150,560],[1050,560]];
    bins = spots.map((p, i) => ({ x: p[0], y: p[1], type: i }));
    const reserved = [...bins.map(b => ({ x: b.x, y: b.y, r: 100 })), { x: 600, y: 390, r: 100 }];
    if (level.scene === "park") {
      garden = { x: 600, y: 325, plants: [] };
      seedChest = { x: 380, y: 390 };
      reserved.push(
        { x: garden.x, y: garden.y, r: 185 },
        { x: seedChest.x, y: seedChest.y, r: 75 },
        { x: 475, y: 325, r: 100 }
      );
    } else if (level.scene === "city") {
      const widths = [110, 142, 128, 98];
      const heights = [105, 130, 92, 116];
      for (let i = 0; i < 8; i++) {
        const index = i % 4;
        const x = i % 2 ? 24 : 862;
        const y = 120 + i * 79;
        const width = widths[index], height = heights[index];
        obstacles.push({ x: x + width / 2, y: y + height / 2, width, height, angle: 0, kind: "building" });
        reserved.push({ x: x + width / 2, y: y + height / 2, r: Math.hypot(width, height) / 2 + 20 });
      }
    }
    const centers = level.scene === "city" ? [[300,210],[890,230],[285,520],[900,500]] :
      level.scene === "beach" ? [[325,130],[865,300],[360,565],[810,160]] :
      [[300,170],[900,295],[290,555],[860,535]];
    for (let i = 0; i < level.obstacles; i++) {
      let candidate;
      let tries = 0;
      do {
        candidate = centers[i % centers.length];
        const spread = 38 + (i % 3) * 13;
        candidate = { x: candidate[0] + (Math.random() - .5) * spread * 2, y: candidate[1] + (Math.random() - .5) * spread * 2, r: level.scene === "city" ? 29 : 24 };
        tries++;
      } while (tries < 20 && reserved.some(p => Math.hypot(candidate.x - p.x, candidate.y - p.y) < p.r + candidate.r + 26));
      obstacles.push({ ...candidate, kind: level.scene === "city" ? "planter" : level.scene === "beach" ? "rock" : level.scene === "park" ? "tree" : i % 3 === 0 ? "flower" : "tree", phase: Math.random() * TAU });
      reserved.push({ ...candidate, r: candidate.r + 35 });
    }
    const trashSpots = [];
    for (let i = 0; i < level.trash; i++) {
      let candidate;
      let tries = 0;
      do {
        candidate = { x: 95 + Math.random() * 1010, y: 115 + Math.random() * 490 };
        tries++;
      } while (tries < 100 && (reserved.some(p => Math.hypot(candidate.x - p.x, candidate.y - p.y) < p.r + 20) || trashSpots.some(p => Math.hypot(candidate.x - p.x, candidate.y - p.y) < 70)));
      const typeIndex = (i * 3 + Math.floor(Math.random() * 4)) % 4;
      trashSpots.push(candidate);
      trash.push({ ...candidate, type: typeIndex, phase: Math.random() * TAU, collected: false });
    }
  }

  function updateHud() {
    ui.score.textContent = String(score).padStart(4, "0");
    const seconds = Math.max(0, Math.ceil(remainingTime));
    ui.timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    ui.timer.style.color = seconds < 20 ? "#dc685b" : "";
    ui.health.textContent = `${"♥ ".repeat(Math.max(0, player.health))}${"♡ ".repeat(3 - Math.max(0, player.health))}`.trim();
    ui.inventoryIcon.textContent = player.carried === null ? "🧤" : trashTypes[player.carried].emoji;
    ui.inventoryName.textContent = player.carried === null ? "Nothing yet" : `${trashTypes[player.carried].kind} · ${trashTypes[player.carried].bin} bin`;
    ui.seedCount.textContent = String(seedCount);
    const sorted = trash.filter(t => t.collected).length;
    const percent = sorted / trash.length * 100;
    ui.progressFill.style.width = `${percent}%`;
    ui.progressCount.textContent = `${sorted} / ${trash.length}`;
  }

  function showToast(message, duration = 1800) {
    el("objective-text").textContent = message;
    ui.objectiveToast.hidden = false;
    toastTimer = duration;
  }

  function setSound(enabled) {
    soundOn = enabled;
    ui.settingsSound.classList.toggle("is-on", soundOn);
    ui.settingsSound.setAttribute("aria-checked", String(soundOn));
    ui.soundLabel.textContent = soundOn ? "Sound on" : "Sound off";
    ui.soundButton.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on");
    ui.soundIcon.innerHTML = soundOn
      ? '<path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>'
      : '<path d="M11 5 6 9H3v6h3l5 4V5Zm5 3 5 8m0-8-5 8"/>';
    if (soundOn) {
      playTone(520, 0.08, "sine", 0.025);
      if (state === "playing" || state === "menu") startMusic();
    } else {
      stopMusic();
    }
  }

  function startMusic() {
    if (!soundOn || musicInterval) return;
    playTone(392, 0.22, "sine", 0.012);
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 987.77, 880, 783.99, 659.25, 587.33];
    musicInterval = window.setInterval(() => {
      if ((state !== "playing" && state !== "menu") || !soundOn) return;
      playTone(notes[musicStep % notes.length], 0.34, "sine", 0.009);
      if (musicStep % 4 === 0) playTone(notes[musicStep % notes.length] / 2, 0.55, "sine", 0.006);
      musicStep++;
    }, 420);
  }

  function stopMusic() {
    if (musicInterval) window.clearInterval(musicInterval);
    musicInterval = 0;
  }

  function playTone(frequency, duration = 0.12, type = "sine", volume = 0.035) {
    if (!soundOn) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn("Sound effects are unavailable in this browser.", error);
    }
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = 35 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 35, life: .45 + Math.random() * .45, maxLife: .9, size: 2 + Math.random() * 4, color });
    }
  }

  function interact() {
    if (state !== "playing") return;
    if (seedChest && Math.hypot(player.x - seedChest.x, player.y - seedChest.y) < 130) {
      seedCount += 7;
      ui.seedCount.textContent = String(seedCount);
      showToast(`Picked up 7 seeds! You have ${seedCount} for the garden.`);
      playTone(520, .12, "sine", .03);
      return;
    }
    if (garden && Math.hypot(player.x - garden.x, player.y - garden.y) < 185) {
      const needsWater = garden.plants.find(plant => plant.wateredAt === null);
      if (needsWater) {
        needsWater.wateredAt = remainingTime;
        burst(garden.x, garden.y, "#72b7d4", 14);
        showToast(`Drip irrigation watered plant ${garden.plants.indexOf(needsWater) + 1} of ${gardenPlotCount}.`);
        playTone(620, .16, "sine", .035);
      } else if (garden.plants.length >= gardenPlotCount) {
        const grown = garden.plants.filter(plant => getPlantGrowth(plant) >= 1).length;
        showToast(grown === gardenPlotCount ? "Your garden is full of 14 blooming plants!" : `Your garden is growing ${grown} of ${gardenPlotCount} plants.`);
      } else if (seedCount === 0) {
        showToast("The garden needs seeds. Pick some up from the seed chest!");
      } else {
        seedCount--;
        garden.plants.push({ wateredAt: null });
        ui.seedCount.textContent = String(seedCount);
        showToast(`Planted ${garden.plants.length} of ${gardenPlotCount}. Press E again to water it.`);
        playTone(440, .12, "sine", .03);
      }
      return;
    }
    dropTrash();
  }

  function dropTrash() {
    if (state !== "playing") return;
    if (player.carried === null) {
      showToast("Pick up a little litter before visiting a bin!");
      playTone(240, .09, "triangle", .025);
      return;
    }
    const bin = bins.find(b => Math.hypot(player.x - b.x, player.y - b.y) < 62);
    if (!bin) {
      showToast("Get a little closer to a recycling bin.");
      return;
    }
    const type = player.carried;
    const carriedItem = player.carriedItem;
    player.carried = null;
    player.carriedItem = null;
    if (bin.type === type) {
      score += 100;
      if (carriedItem) carriedItem.sorted = true;
      burst(bin.x, bin.y - 20, binPalette[bin.type].color, 16);
      playTone(620, .1, "sine", .04);
      setTimeout(() => playTone(820, .12, "sine", .03), 75);
      showToast(["Lovely sorting! +100 points 🌿", "Right where it belongs! +100 points ✨", "The planet says thank you! +100 🌼"][Math.floor(Math.random() * 3)]);
      updateHud();
      if (trash.every(t => t.sorted)) finishLevel(true);
    } else {
      score = Math.max(0, score - 25);
      player.health = Math.max(0, player.health - 1);
      if (carriedItem) {
        carriedItem.x = player.x - player.facing * 22;
        carriedItem.y = player.y + 9;
        carriedItem.collected = false;
      }
      burst(bin.x, bin.y - 15, "#ec8c72", 8);
      playTone(190, .18, "triangle", .035);
      showToast(`Oops! ${trashTypes[type].kind} goes in the ${trashTypes[type].bin} bin. −25 points`);
      updateHud();
      if (player.health === 0) finishLevel(false);
    }
  }

  function pickupItem(item) {
    item.collected = true;
    player.carried = item.type;
    player.carriedItem = item;
    score += 25;
    burst(item.x, item.y, "#ffe9a8", 11);
    playTone(520 + item.type * 75, .1, "sine", .035);
    showToast(`Found ${trashTypes[item.type].kind.toLowerCase()}! Find the ${trashTypes[item.type].bin.toLowerCase()} bin.`);
    updateHud();
  }

  function finishLevel(won) {
    if (state !== "playing") return;
    state = won ? "result" : "gameover";
    stopMusic();
    updateHeader();
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("cleanEarthBest", String(bestScore));
      ui.bestScore.textContent = String(bestScore).padStart(4, "0");
    }
    el("result-art").textContent = won ? (levelIndex === levels.length - 1 ? "🌍" : "🌼") : "🌱";
    el("result-kicker").textContent = won ? (levelIndex === levels.length - 1 ? "YOU DID IT, HERO" : "MISSION COMPLETE") : "A LITTLE RESET";
    el("result-title").textContent = won ? (levelIndex === levels.length - 1 ? "Look at that lovely planet." : "Look what you did.") : "The planet can wait.";
    el("result-message").textContent = won
      ? (levelIndex === levels.length - 1 ? "Four places, one big difference. Our whole planet is a little greener thanks to you." : "A little patch of the planet is smiling again. Ready for the next adventure?")
      : "You ran out of energy. Rest up, then come back and give it another go.";
    el("result-score").textContent = String(score).padStart(4, "0");
    el("next-level").hidden = !won || levelIndex === levels.length - 1;
    el("next-level").querySelector("strong").textContent = levels[Math.min(levelIndex + 1, levels.length - 1)].name;
    el("continue-button").hidden = !won || levelIndex === levels.length - 1;
    el("result-home-button").textContent = won && levelIndex === levels.length - 1 ? "Play again" : won ? "Back to the garden" : "Try again";
    setScreen("result");
    playTone(won ? 690 : 220, .22, "sine", .04);
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    stopMusic();
    setScreen("pause");
    updateHeader();
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    setScreen("");
    updateHeader();
    lastTime = performance.now();
    startMusic();
  }

  function movePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys.has("arrowleft") || keys.has("a")) dx--;
    if (keys.has("arrowright") || keys.has("d")) dx++;
    if (keys.has("arrowup") || keys.has("w")) dy--;
    if (keys.has("arrowdown") || keys.has("s")) dy++;
    if (touchMove) { dx += touchMove.x; dy += touchMove.y; }
    if (dx && dy) { dx *= .7071; dy *= .7071; }
    const speed = 220;
    player.vx += (dx * speed - player.vx) * Math.min(1, dt * 13);
    player.vy += (dy * speed - player.vy) * Math.min(1, dt * 13);
    if (!dx) player.vx *= Math.max(0, 1 - dt * 8);
    if (!dy) player.vy *= Math.max(0, 1 - dt * 8);
    const previousX = player.x, previousY = player.y;
    const nextX = Math.max(39, Math.min(W - 39, player.x + player.vx * dt));
    const nextY = Math.max(95, Math.min(H - 39, player.y + player.vy * dt));
    player.x = nextX;
    player.y = nextY;
    const hit = obstacles.find(obstacle => isBlocked(player.x, player.y, obstacle));
    if (hit) {
      player.x = previousX;
      player.y = previousY;
      player.vx = 0;
      player.vy = 0;
      if (hit.kind !== "tree" && player.invulnerable <= 0) {
        player.health--;
        player.invulnerable = 1.1;
        playTone(175, .14, "triangle", .03);
        burst(player.x, player.y, "#f08c76", 6);
        showToast("Watch out! Those little obstacles can bump your energy.");
        updateHud();
        if (player.health <= 0) finishLevel(false);
      }
    }
    if (Math.abs(player.vx) + Math.abs(player.vy) > 15) {
      player.walk += dt * 11;
      if (Math.abs(player.vx) > 4) player.facing = Math.sign(player.vx);
    }
    if (player.invulnerable > 0) player.invulnerable -= dt;
    for (const item of trash) {
      if (!item.collected && player.carried === null && Math.hypot(player.x - item.x, player.y - item.y) < 30) {
        pickupItem(item);
        break;
      }
    }
  }

  function isBlocked(x, y, obstacle) {
    if (obstacle.width) {
      const dx = x - obstacle.x, dy = y - obstacle.y;
      const angle = obstacle.angle || 0;
      const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
      const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const closestX = Math.max(-obstacle.width / 2, Math.min(obstacle.width / 2, localX));
      const closestY = Math.max(-obstacle.height / 2, Math.min(obstacle.height / 2, localY));
      return (localX - closestX) ** 2 + (localY - closestY) ** 2 < 16 ** 2;
    }
    return Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.r + 15;
  }

  function update(dt) {
    const step = Math.min(dt, .045);
    if (motionOn) elapsed += step;
    if (state === "playing") {
      remainingTime -= step;
      movePlayer(step);
      if (remainingTime <= 0 && state === "playing") finishLevel(false);
      updateHud();
    }
    if (toastTimer > 0) {
      toastTimer -= step * 1000;
      if (toastTimer <= 0) ui.objectiveToast.hidden = true;
    }
    if (motionOn) {
      particles = particles.filter(p => p.life > 0);
      for (const p of particles) {
        p.life -= step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.vy += 120 * step;
      }
    }
  }

  function draw() {
    const level = levels[levelIndex];
    drawBackground(level);
    drawDecor(level);
    if (state === "menu") return;
    for (const obstacle of obstacles) drawObstacle(obstacle, level);
    if (garden) drawGarden();
    if (seedChest) drawSeedChest();
    for (const bin of bins) drawBin(bin);
    for (const item of trash) if (!item.collected) drawTrash(item);
    drawPlayer();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground(level) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    const c = level.colors;
    grad.addColorStop(0, c[0]);
    grad.addColorStop(.64, c[1]);
    grad.addColorStop(1, c[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    if (level.scene === "beach") {
      ctx.fillStyle = "#75c9c1";
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(1200, 0); ctx.lineTo(1200, 80);
      for (let x = 1200; x >= 0; x -= 40) ctx.lineTo(x, 86 + Math.sin(x * .019 + elapsed * .7) * 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff29";
      for (let i = 0; i < 13; i++) {
        const x = (i * 121 + elapsed * 22) % 1260 - 20, y = 16 + (i % 4) * 16;
        ctx.fillRect(x, y, 22 + i % 4 * 4, 2);
      }
      ctx.fillStyle = "#f4e3b9";
      ctx.fillRect(0, 87, W, 13);
    } else if (level.scene === "forest") {
      ctx.fillStyle = "#edf0cb40";
      for (let x = 0; x < W; x += 150) { ctx.beginPath(); ctx.arc(x + 75, 85, 100, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#e2d7a1";
      ctx.beginPath(); ctx.moveTo(455, 0); ctx.bezierCurveTo(480, 180, 680, 200, 637, 345); ctx.bezierCurveTo(580, 510, 747, 550, 718, 720); ctx.lineTo(900, 720); ctx.bezierCurveTo(820, 525, 732, 460, 778, 330); ctx.bezierCurveTo(833, 155, 634, 143, 627, 0); ctx.fill();
    } else if (level.scene === "city") {
      ctx.fillStyle = "#e3dcb6";
      ctx.beginPath(); ctx.moveTo(480, 0); ctx.lineTo(720, 0); ctx.lineTo(820, 720); ctx.lineTo(365, 720); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f9f0cf";
      for (let y = -10; y < H; y += 84) ctx.fillRect(589, y, 5, 37);
      ctx.fillStyle = "#bcceaa";
      for (let x = 76; x < W; x += 112) ctx.fillRect(x, 0, 2, H);
      for (let y = 160; y < H; y += 112) ctx.fillRect(0, y, W, 2);
    }
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = level.scene === "beach" ? "#b9a875" : "#6e9a65";
    ctx.lineWidth = 1;
    for (let i = 0; i < 120; i++) {
      const x = (i * 137 + 19) % W, y = 100 + (i * 83) % (H - 100);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + ((i % 3) - 1) * 4, y - 5 - i % 4 * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDecor(level) {
    if (level.scene === "beach") {
      for (let i = 0; i < 8; i++) {
        const x = 75 + i * 155, y = 120 + (i % 3) * 197;
        drawShell(x, y, i);
      }
      for (let i = 0; i < 5; i++) drawPalm(70 + i * 275, i % 2 ? 590 : 125, i % 2 ? -.16 : .14);
    } else if (level.scene === "city") {
      for (let i = 0; i < 8; i++) drawBuilding(i % 2 ? 24 : 862, 120 + i * 79, i % 4);
      for (let i = 0; i < 5; i++) drawStreetTree(90 + i * 260, i % 2 ? 630 : 115);
    } else {
      if (level.scene !== "park") {
        for (let i = 0; i < 11; i++) {
          const x = 35 + (i * 103) % 1120, y = 112 + (i * 163) % 567;
          if (Math.hypot(x - player.x, y - player.y) > 85) drawFlower(x, y, i);
        }
      }
      for (let i = 0; i < (level.scene === "forest" ? 13 : 0); i++) {
        const x = i < 7 ? 27 + i * 185 : 35 + ((i * 217) % 1130);
        const y = i < 7 ? (i % 2 ? 681 : 95) : 100 + ((i * 119) % 550);
        if (Math.hypot(x - player.x, y - player.y) > 72) drawTree(x, y, i, 1.1);
      }
    }
    drawFloatingMotes(level);
  }

  function drawFloatingMotes(level) {
    const colors = level.scene === "beach" ? ["#fff9d1", "#ffffff"] : ["#fcf3bd", "#fff"];
    for (let i = 0; i < 8; i++) {
      const x = (i * 177 + Math.sin(elapsed * .34 + i) * 14 + 35) % W;
      const y = (i * 113 + elapsed * (8 + i % 3 * 3)) % H;
      ctx.globalAlpha = .24 + (Math.sin(elapsed * 1.3 + i) + 1) * .17;
      ctx.fillStyle = colors[i % 2];
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? 2 : 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFlower(x, y, i) {
    const colors = ["#fff7dd", "#f7d8d1", "#e7ecb7", "#e1ddfa"];
    const r = 2.8 + (i % 3) * .8;
    ctx.fillStyle = "#639765";
    ctx.fillRect(x - .5, y, 1, 10);
    ctx.fillStyle = colors[i % colors.length];
    for (let j = 0; j < 5; j++) {
      const angle = j * TAU / 5;
      ctx.beginPath(); ctx.arc(x + Math.cos(angle) * r, y + Math.sin(angle) * r, r * .6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#eebd64"; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill();
  }

  function drawTree(x, y, i, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = "#587a4f26"; ctx.beginPath(); ctx.ellipse(4, 3, 32, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#99794e"; ctx.fillRect(-5, -42, 10, 43);
    ctx.fillStyle = "#876b47"; ctx.fillRect(-5, -40, 4, 35);
    const colors = ["#82b774", "#77ad70", "#94bf78", "#6ea96d"];
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = colors[(i + j) % colors.length];
      ctx.beginPath(); ctx.arc((j - 1) * 14, -48 - (j % 2) * 7, 17 + (j === 1 ? 4 : 0), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#c4dc95aa"; ctx.beginPath(); ctx.arc(-8, -56, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawStreetTree(x, y) {
    ctx.fillStyle = "#8b704c"; ctx.fillRect(x - 4, y - 33, 8, 34);
    ctx.fillStyle = "#7aac72"; ctx.beginPath(); ctx.arc(x, y - 39, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = "#9bc586"; ctx.beginPath(); ctx.arc(x - 7, y - 45, 10, 0, TAU); ctx.fill();
  }

  function drawPalm(x, y, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.fillStyle = "#a88956";
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-10, -45, -1, -87); ctx.lineTo(5, -88); ctx.quadraticCurveTo(2, -46, 5, 0); ctx.fill();
    ctx.strokeStyle = "#7a9d62"; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7;
      ctx.beginPath(); ctx.moveTo(2, -83); ctx.quadraticCurveTo(Math.cos(a) * 24, -120 + Math.sin(a) * 9, Math.cos(a) * 45, -91 + Math.sin(a) * 17); ctx.stroke();
    }
    ctx.restore();
  }

  function drawShell(x, y, i) {
    ctx.fillStyle = i % 2 ? "#fff0d3" : "#f1caa7";
    ctx.beginPath(); ctx.arc(x, y, 7, Math.PI, 0); ctx.lineTo(x + 7, y + 3); ctx.lineTo(x - 7, y + 3); ctx.fill();
    ctx.strokeStyle = "#d9ad8b"; ctx.lineWidth = .7;
    for (let n = -2; n <= 2; n++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + n * 2.4, y + 3); ctx.stroke(); }
  }

  function drawBuilding(x, y, index) {
    const widths = [110, 142, 128, 98];
    const heights = [105, 130, 92, 116];
    const width = widths[index], height = heights[index];
    const colors = ["#d7bfa1", "#d4c9a8", "#c4c9ac", "#d7ab94"];
    ctx.fillStyle = "#6c76632b"; ctx.fillRect(x + 5, y + height - 2, width, 8);
    ctx.fillStyle = colors[index]; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#e7d8b8"; ctx.fillRect(x + 6, y + 6, width - 12, 8);
    for (let wy = y + 23; wy < y + height - 15; wy += 28) {
      for (let wx = x + 12; wx < x + width - 15; wx += 25) {
        ctx.fillStyle = index % 2 ? "#90aeb0" : "#9cb6ad";
        ctx.fillRect(wx, wy, 11, 13);
        ctx.fillStyle = "#ffffff55"; ctx.fillRect(wx, wy, 3, 13);
      }
    }
  }

  function getPlantGrowth(plant) {
    return plant.wateredAt === null ? 0 : Math.min(1, (plant.wateredAt - remainingTime) / 5);
  }

  function getGardenPlantPosition(index) {
    return {
      x: garden.x - 135 + index % gardenColumns * 45,
      y: garden.y - 27 + Math.floor(index / gardenColumns) * 54
    };
  }

  function drawGarden() {
    const { x, y, plants } = garden;

    ctx.fillStyle = "#52674330";
    ctx.beginPath(); ctx.ellipse(x, y + 29, 194, 80, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#816447";
    ctx.beginPath(); ctx.roundRect(x - 186, y - 78, 372, 156, 15); ctx.fill();
    ctx.fillStyle = "#5d4533";
    ctx.beginPath(); ctx.roundRect(x - 178, y - 70, 356, 140, 11); ctx.fill();
    ctx.fillStyle = "#77573d";
    for (let i = 0; i < 46; i++) {
      const soilX = x - 166 + (i * 47) % 333;
      const soilY = y - 60 + (i * 29) % 121;
      ctx.beginPath(); ctx.ellipse(soilX, soilY, 2.2, 1.3, 0, 0, TAU); ctx.fill();
    }

    for (let row = 0; row < 2; row++) {
      const firstIndex = row * gardenColumns;
      const firstPlant = getGardenPlantPosition(firstIndex);
      const lastPlant = getGardenPlantPosition(firstIndex + gardenColumns - 1);
      const pipeY = firstPlant.y - 18;
      ctx.strokeStyle = "#557b55";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(firstPlant.x - 8, pipeY); ctx.lineTo(lastPlant.x + 8, pipeY); ctx.stroke();
      for (let column = 0; column < gardenColumns; column++) {
        const index = firstIndex + column;
        const position = getGardenPlantPosition(index);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(position.x, pipeY); ctx.lineTo(position.x, position.y - 9); ctx.stroke();
        const plant = plants[index];
        if (plant && plant.wateredAt !== null && getPlantGrowth(plant) < 1 && (index + Math.floor(elapsed * 2)) % 2 === 0) {
          ctx.fillStyle = "#76c6e8";
          ctx.beginPath(); ctx.ellipse(position.x, position.y - 5 + Math.sin(elapsed * 7 + index) * 2, 2, 3, 0, 0, TAU); ctx.fill();
        }
      }
    }

    for (let index = 0; index < gardenPlotCount; index++) {
      const position = getGardenPlantPosition(index);
      const plant = plants[index];
      if (plant) {
        const growth = getPlantGrowth(plant);
        const stemHeight = 9 + growth * 27;
        const top = position.y + 7 - stemHeight;
        ctx.strokeStyle = "#5e9d55";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(position.x, position.y + 7); ctx.lineTo(position.x, top); ctx.stroke();
        ctx.fillStyle = "#71ae60";
        ctx.beginPath(); ctx.ellipse(position.x - 5, position.y + 1 - growth * 10, 7 + growth * 3, 3 + growth, -.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(position.x + 6, position.y - 5 - growth * 17, 7 + growth * 3, 3 + growth, .4, 0, TAU); ctx.fill();
        if (growth >= 1) {
          const flowerColors = ["#f3a5a1", "#e7b5ee", "#f4c767", "#ef91b2"];
          const flowerY = top - 7;
          ctx.fillStyle = flowerColors[index % flowerColors.length];
          for (let petal = 0; petal < 6; petal++) {
            const angle = petal * TAU / 6;
            ctx.beginPath(); ctx.arc(position.x + Math.cos(angle) * 8, flowerY + Math.sin(angle) * 8, 5, 0, TAU); ctx.fill();
          }
          ctx.fillStyle = "#f7d66c";
          ctx.beginPath(); ctx.arc(position.x, flowerY, 4, 0, TAU); ctx.fill();
        }
      } else {
        ctx.fillStyle = "#3e342a";
        ctx.beginPath(); ctx.ellipse(position.x, position.y + 8, 4, 2.5, 0, 0, TAU); ctx.fill();
      }
    }

    const grownCount = plants.filter(plant => getPlantGrowth(plant) >= 1).length;
    const needsWater = plants.findIndex(plant => plant.wateredAt === null);
    const label = needsWater >= 0
      ? `DRIP LINE · WATER ${needsWater + 1}/${gardenPlotCount}`
      : plants.length === gardenPlotCount
        ? grownCount === gardenPlotCount ? "GARDEN FULL · 14 BLOOMS" : `GROWING · ${grownCount}/${gardenPlotCount}`
        : `GARDEN · ${plants.length}/${gardenPlotCount} PLANTED`;
    ctx.fillStyle = "#fffdf1";
    ctx.beginPath(); ctx.roundRect(x - 103, y + 81, 206, 20, 5); ctx.fill();
    ctx.fillStyle = "#526c55";
    ctx.font = "700 9px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + 91);
  }

  function drawSeedChest() {
    const { x, y } = seedChest;
    const near = Math.hypot(player.x - x, player.y - y) < 138;
    if (near) {
      ctx.globalAlpha = .7 + Math.sin(elapsed * 5) * .2;
      ctx.strokeStyle = "#e8c66c";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 42, 34, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#52674330";
    ctx.beginPath(); ctx.ellipse(x, y + 23, 34, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#68462f";
    ctx.beginPath(); ctx.roundRect(x - 29, y - 10, 58, 34, 7); ctx.fill();
    ctx.fillStyle = "#9c6a3d";
    ctx.beginPath(); ctx.roundRect(x - 26, y - 8, 52, 29, 6); ctx.fill();
    ctx.fillStyle = "#bd8b52";
    ctx.beginPath(); ctx.roundRect(x - 31, y - 15, 62, 12, 6); ctx.fill();
    ctx.fillStyle = "#e7c56e";
    ctx.fillRect(x - 3, y - 5, 6, 24);
    ctx.fillStyle = "#f4d988";
    ctx.fillRect(x - 4, y + 2, 8, 6);
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌰", x - 12, y - 16);
    ctx.fillText("🌰", x + 12, y - 16);

    ctx.fillStyle = "#fffdf1";
    ctx.beginPath(); ctx.roundRect(x - 62, y + 31, 124, 18, 5); ctx.fill();
    ctx.fillStyle = "#526c55";
    ctx.font = "700 9px 'DM Sans', sans-serif";
    ctx.fillText("SEED CHEST · E +7", x, y + 40);
  }

  function drawObstacle(o, level) {
    const bob = Math.sin(elapsed * 1.2 + o.phase) * 1.1;
    if (o.kind === "building") return;
    if (o.kind === "rock") {
      ctx.fillStyle = "#8c927d40"; ctx.beginPath(); ctx.ellipse(o.x, o.y + 3, o.r + 4, o.r * .5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#b2aa90"; ctx.beginPath(); ctx.ellipse(o.x, o.y + bob, o.r, o.r * .75, .1, 0, TAU); ctx.fill();
      ctx.fillStyle = "#d3c7a6"; ctx.beginPath(); ctx.ellipse(o.x - 6, o.y - 5 + bob, o.r * .47, o.r * .3, -.3, 0, TAU); ctx.fill();
      return;
    }
    if (o.kind === "planter") {
      ctx.fillStyle = "#7b826247"; ctx.beginPath(); ctx.ellipse(o.x, o.y + 14, 33, 13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#c2a883"; ctx.beginPath(); ctx.roundRect(o.x - 31, o.y - 10, 62, 25, 5); ctx.fill();
      ctx.fillStyle = "#8cae77"; ctx.beginPath(); ctx.ellipse(o.x, o.y - 12 + bob, 25, 18, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ["#f5d992","#fff0d1","#e8b8a8","#ded7f1"][i]; ctx.beginPath(); ctx.arc(o.x - 15 + i * 10, o.y - 18 - (i % 2) * 5 + bob, 3.5, 0, TAU); ctx.fill(); }
      return;
    }
    if (o.kind === "flower") {
      drawFlower(o.x, o.y, Math.floor(o.phase * 9));
      return;
    }
    const scale = level.scene === "forest" ? .75 : .68;
    drawTree(o.x, o.y, Math.floor(o.phase * 9), scale);
  }

  function drawBin(bin) {
    const pal = binPalette[bin.type];
    const near = player.carried !== null && Math.hypot(player.x - bin.x, player.y - bin.y) < 70;
    ctx.fillStyle = "#44554124"; ctx.beginPath(); ctx.ellipse(bin.x, bin.y + 22, 30, 8, 0, 0, TAU); ctx.fill();
    if (near) {
      ctx.globalAlpha = .7 + Math.sin(elapsed * 5) * .2;
      ctx.strokeStyle = pal.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(bin.x, bin.y - 4, 37, 36, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = pal.dark;
    ctx.beginPath(); ctx.roundRect(bin.x - 22, bin.y - 13, 44, 37, 7); ctx.fill();
    ctx.fillStyle = pal.color;
    ctx.beginPath(); ctx.roundRect(bin.x - 20, bin.y - 12, 40, 34, 6); ctx.fill();
    ctx.fillStyle = "#ffffff38";
    ctx.beginPath(); ctx.roundRect(bin.x - 14, bin.y - 7, 5, 23, 3); ctx.fill();
    ctx.fillStyle = pal.dark;
    ctx.beginPath(); ctx.roundRect(bin.x - 25, bin.y - 17, 50, 7, 3); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "700 14px 'DM Sans', sans-serif";
    ctx.fillText(["▤", "♻", "♢", "◉"][bin.type], bin.x, bin.y + 3);
    ctx.fillStyle = "#3e523f";
    ctx.font = "800 7px 'DM Sans', sans-serif";
    ctx.fillText(pal.label, bin.x, bin.y + 33);
    if (near) {
      ctx.fillStyle = "#fffdf1";
      ctx.beginPath(); ctx.roundRect(bin.x - 27, bin.y - 43, 54, 19, 5); ctx.fill();
      ctx.fillStyle = "#526c55"; ctx.font = "700 9px 'DM Sans', sans-serif";
      ctx.fillText("E  ·  SORT", bin.x, bin.y - 34);
    }
  }

  function drawTrash(item) {
    const bob = Math.sin(elapsed * 2.8 + item.phase) * 2;
    const type = trashTypes[item.type];
    ctx.fillStyle = "#4b5c3c24";
    ctx.beginPath(); ctx.ellipse(item.x, item.y + 10, 12, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffdf0";
    ctx.beginPath(); ctx.arc(item.x, item.y + bob, 13, 0, TAU); ctx.fill();
    ctx.globalAlpha = .55;
    ctx.strokeStyle = type.color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(item.x, item.y + bob, 12.5, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(type.emoji, item.x, item.y + 1 + bob);
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(elapsed * 14) % 2 === 0) return;
    const walk = Math.sin(player.walk);
    const bob = Math.abs(walk) * 1.5;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(player.facing, 1);
    ctx.fillStyle = "#3c533b2b";
    ctx.beginPath(); ctx.ellipse(0, 13, 17, 7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#4f7154"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-5, 2 - bob); ctx.lineTo(-6 + walk * 3, 10); ctx.moveTo(5, 2 - bob); ctx.lineTo(6 - walk * 3, 10); ctx.stroke();
    ctx.fillStyle = "#e59d73";
    ctx.beginPath(); ctx.arc(-7, -6 - bob, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -6 - bob, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffdf2";
    ctx.beginPath(); ctx.ellipse(0, -6 - bob, 12, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#76a96d";
    ctx.beginPath(); ctx.roundRect(-9, -5 - bob, 18, 12, 5); ctx.fill();
    ctx.fillStyle = "#f0d18a";
    ctx.beginPath(); ctx.arc(0, -10 - bob, 5.3, Math.PI, 0); ctx.lineTo(5.3, -9 - bob); ctx.lineTo(-5.3, -9 - bob); ctx.fill();
    ctx.fillStyle = "#425642"; ctx.beginPath(); ctx.arc(3.2, -7 - bob, 1.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#425642"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(1.5, -3 - bob, 2.4, .25, 1.3); ctx.stroke();
    ctx.fillStyle = "#4d7f54"; ctx.beginPath(); ctx.roundRect(-10, 2 - bob, 20, 5, 3); ctx.fill();
    if (player.carried !== null) {
      ctx.font = "14px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(trashTypes[player.carried].emoji, 11, -21 - bob);
    }
    ctx.restore();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function frame(now) {
    const dt = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function setMotion(enabled) {
    motionOn = enabled;
    ui.motionToggle.classList.toggle("is-on", enabled);
    ui.motionToggle.setAttribute("aria-checked", String(enabled));
    document.body.classList.toggle("reduced-motion", !enabled);
  }

  el("play-button").addEventListener("click", () => startGame(0));
  el("how-button").addEventListener("click", () => setScreen("how"));
  el("how-play-button").addEventListener("click", () => startGame(0));
  el("how-back-button").addEventListener("click", () => setScreen("menu"));
  function openSettings() {
    if (state === "playing") {
      state = "paused";
      stopMusic();
    }
    settingsReturnScreen = state === "paused" ? "pause" :
      state === "result" || state === "gameover" ? "result" : "menu";
    setScreen("settings");
    updateHeader();
  }

  el("settings-button").addEventListener("click", openSettings);
  el("footer-settings-button").addEventListener("click", openSettings);
  el("settings-back-button").addEventListener("click", () => {
    setScreen(settingsReturnScreen);
    updateHeader();
  });
  el("sound-button").addEventListener("click", () => setSound(!soundOn));
  ui.settingsSound.addEventListener("click", () => setSound(!soundOn));
  ui.motionToggle.addEventListener("click", () => setMotion(!motionOn));
  el("pause-button").addEventListener("click", pauseGame);
  el("resume-button").addEventListener("click", resumeGame);
  el("pause-home-button").addEventListener("click", () => {
    state = "menu"; setScreen("menu"); updateHeader(); startMusic();
  });
  el("continue-button").addEventListener("click", () => startGame(levelIndex + 1));
  el("result-home-button").addEventListener("click", () => {
    if (state === "gameover" || levelIndex === levels.length - 1) startGame(0);
    else { state = "menu"; setScreen("menu"); updateHeader(); startMusic(); }
  });
  window.addEventListener("pointerdown", () => {
    if (state === "menu") startMusic();
  });
  window.addEventListener("keydown", () => {
    if (state === "menu") startMusic();
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" && state === "playing") {
      canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      touchMove = { x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H };
      touchMove.x = Math.max(-1, Math.min(1, (touchMove.x - player.x) / 65));
      touchMove.y = Math.max(-1, Math.min(1, (touchMove.y - player.y) / 65));
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" && state === "playing" && event.buttons) {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * W;
      const y = (event.clientY - rect.top) / rect.height * H;
      touchMove = { x: Math.max(-1, Math.min(1, (x - player.x) / 65)), y: Math.max(-1, Math.min(1, (y - player.y) / 65)) };
    }
  });
  canvas.addEventListener("pointerup", () => { touchMove = null; });
  canvas.addEventListener("pointercancel", () => { touchMove = null; });
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) keys.add(key);
    if ((key === "e" || key === " ") && !event.repeat) interact();
    if (key === "escape" || key === "p") {
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
      else if (state === "settings" || state === "how") setScreen("menu");
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => { keys.clear(); touchMove = null; if (state === "playing") pauseGame(); });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseGame(); });

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  setMotion(motionOn);
  setScreen("menu");
  updateHeader();
  resize();
  requestAnimationFrame(frame);
})();
