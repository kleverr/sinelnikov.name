const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const NOTE_STATES = ["neutral", "maybe", "placed", "blocked"];
const MAX_TRIES = 10;

const state = {
  secret: "",
  move: 1,
  gameOver: false,
  history: [],
  digitMarks: Object.fromEntries(DIGITS.map((digit) => [digit, "neutral"])),
  hintCount: 0,
  usedHints: false,
};

const actionForm = document.querySelector("#action-form");
const actionInputs = [...actionForm.querySelectorAll(".digit-input")];
const solveButton = document.querySelector("#solve-button");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const clearNotesButton = document.querySelector("#clear-notes-button");
const newGameButton = document.querySelector("#new-game-button");
const hintButton = document.querySelector("#hint-button");
const showAnswerButton = document.querySelector("#show-answer-button");
const rulesDialog = document.querySelector("#rules-dialog");
const rulesButton = document.querySelector("#rules-button");
const closeRulesButton = document.querySelector("#close-rules-button");
const storyDialog = document.querySelector("#story-dialog");
const storyButton = document.querySelector("#story-button");
const closeStoryButton = document.querySelector("#close-story-button");
const confettiLayer = document.querySelector("#confetti-layer");
const winDialog = document.querySelector("#win-dialog");
const winForm = document.querySelector("#win-form");
const winNameInput = document.querySelector("#win-name-input");
const winMessage = document.querySelector("#win-message");
const leaderboardDialog = document.querySelector("#leaderboard-dialog");
const leaderboardButton = document.querySelector("#leaderboard-button");
const closeLeaderboardButton = document.querySelector("#close-leaderboard-button");
const leaderboardBody = document.querySelector("#leaderboard-body");

const STORAGE_KEY = "rose-lilly-leaderboard";

function randomSecret() {
  const pool = [...DIGITS];
  let code = "";

  while (code.length < 4) {
    const index = Math.floor(Math.random() * pool.length);
    code += pool.splice(index, 1)[0];
  }

  return code;
}

function isValidGuess(value) {
  if (!/^\d{4}$/.test(value)) {
    return "4 digits";
  }

  if (new Set(value).size !== 4) {
    return "no repeats";
  }

  return "";
}

function scoreGuess(guess, secret) {
  let roses = 0;
  let lillies = 0;

  for (let index = 0; index < guess.length; index += 1) {
    if (guess[index] === secret[index]) {
      roses += 1;
    } else if (secret.includes(guess[index])) {
      lillies += 1;
    }
  }

  return { roses, lillies };
}

function createBadge(label, className = "") {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`.trim();
  badge.textContent = label;
  return badge;
}

function createDigitChip(digit) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "digit-chip";
  button.dataset.digit = digit;
  button.dataset.mark = state.digitMarks[digit];
  button.setAttribute("aria-label", `Digit ${digit}, ${state.digitMarks[digit]}`);
  button.textContent = digit;
  return button;
}

function createNotation(entry) {
  const wrap = document.createElement("div");
  wrap.className = "notation";

  if (entry.type === "guess") {
    for (let index = 0; index < entry.roses; index += 1) {
      const token = document.createElement("span");
      token.className = "notation-token-rose";
      token.textContent = "🌹";
      wrap.append(token);
    }

    for (let index = 0; index < entry.lillies; index += 1) {
      const token = document.createElement("span");
      token.className = "notation-token-lilly";
      token.textContent = "🪷";
      wrap.append(token);
    }

    if (entry.roses === 0 && entry.lillies === 0) {
      wrap.textContent = "—";
    }
  } else {
    const token = document.createElement("span");
    token.className = "notation-token-final";
    token.textContent = entry.resultText;
    wrap.append(token);
  }

  return wrap;
}

function readDigitInputs(inputs) {
  return inputs.map((input) => input.value.trim()).join("");
}

function clearDigitInputs(inputs) {
  inputs.forEach((input) => {
    input.value = "";
  });
}

function wireDigitInputs(inputs) {
  inputs.forEach((input, index) => {
    function selectAll() {
      requestAnimationFrame(() => {
        input.setSelectionRange(0, input.value.length);
      });
    }

    input.addEventListener("focus", selectAll);
    input.addEventListener("click", selectAll);
    input.addEventListener("mouseup", (event) => {
      event.preventDefault();
    });

    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 1);
      if (input.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
  });
}

function renderHistory() {
  historyList.innerHTML = "";
  historyEmpty.hidden = state.history.length > 0;

  state.history.forEach((entry) => {
    const row = document.createElement("article");
    row.className = `history-grid-row${entry.label === "info" ? " history-info-row" : ""}`;

    [...entry.guess].forEach((digit) => {
      row.append(createDigitChip(digit));
    });

    const meta = document.createElement("div");
    meta.className = "entry-meta";
    meta.append(createBadge(entry.label));

    row.append(createNotation(entry), meta);
    historyList.append(row);
  });
}

function renderAll() {
  renderHistory();
}

function applyTheme(themeName) {
  document.body.dataset.theme = themeName;
}

function resetMarks() {
  DIGITS.forEach((digit) => {
    state.digitMarks[digit] = "neutral";
  });
}

function loadLeaderboard() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { entries: data.entries || [], lastName: data.lastName || "" };
  } catch {
    return { entries: [], lastName: "" };
  }
}

function saveLeaderboard(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

function addLeaderboardEntry(name, moves, history) {
  const data = loadLeaderboard();
  data.entries.push({
    name,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    moves,
    history: history
      .filter((entry) => entry.type === "guess")
      .reverse()
      .map((entry) => ({ guess: entry.guess, roses: entry.roses, lillies: entry.lillies })),
  });
  data.entries.sort((a, b) => a.moves - b.moves);
  data.lastName = name;
  saveLeaderboard(data);
}

function renderLeaderboard() {
  const { entries } = loadLeaderboard();
  leaderboardBody.innerHTML = "";

  if (entries.length === 0) {
    leaderboardBody.textContent = "No wins yet. Be the first!";
    return;
  }

  const table = document.createElement("table");
  table.className = "leaderboard-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>#</th><th>Name</th><th>Date</th><th>Moves</th></tr>";
  table.append(thead);

  const tbody = document.createElement("tbody");

  entries.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.className = "leaderboard-row";
    row.innerHTML = `<td>${index + 1}</td><td>${escapeHtml(entry.name)}</td><td>${entry.date}</td><td>${entry.moves}</td>`;

    if (entry.history && entry.history.length > 0) {
      row.classList.add("has-history");
      row.addEventListener("click", () => {
        const existing = row.nextElementSibling;
        if (existing && existing.classList.contains("history-detail-row")) {
          existing.remove();
          return;
        }

        const detailRow = document.createElement("tr");
        detailRow.className = "history-detail-row";
        const detailCell = document.createElement("td");
        detailCell.colSpan = 4;

        entry.history.forEach((move, moveIndex) => {
          const moveDiv = document.createElement("div");
          moveDiv.className = "history-move";

          let result = "";
          for (let i = 0; i < move.roses; i++) result += "🌹";
          for (let i = 0; i < move.lillies; i++) result += "🪷";
          if (move.roses === 0 && move.lillies === 0) result = "—";

          moveDiv.textContent = `#${moveIndex + 1}: ${move.guess}  ${result}`;
          detailCell.append(moveDiv);
        });

        detailRow.append(detailCell);
        row.after(detailRow);
      });
    }

    tbody.append(row);
  });

  table.append(tbody);
  leaderboardBody.append(table);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showWinDialog(moves) {
  const { lastName } = loadLeaderboard();
  winMessage.textContent = `You won in ${moves} move${moves === 1 ? "" : "s"}!`;

  if (state.usedHints) {
    winForm.classList.add("hints-used");
    winNameInput.value = "";
    winDialog.showModal();
  } else {
    winForm.classList.remove("hints-used");
    winNameInput.value = lastName;
    winDialog.showModal();
    winNameInput.focus();
    if (lastName) {
      winNameInput.select();
    }
  }
}

function startGame() {
  state.secret = randomSecret();
  state.move = 1;
  state.gameOver = false;
  state.history = [];
  state.hintCount = 0;
  state.usedHints = false;
  resetMarks();
  clearDigitInputs(actionInputs);
  confettiLayer.innerHTML = "";
  document.body.classList.remove("win-mode");
  renderAll();
  actionInputs[0].focus();
}

function lockGame() {
  state.gameOver = true;
}

function celebrateWin() {
  confettiLayer.innerHTML = "";
  document.body.classList.add("win-mode");

  const palette = ["#d84e7d", "#f1b85b", "#5b8bd8", "#5aa25d", "#33a6ac", "#e65cad", "#ffd700"];
  const flowers = ["🌸", "🌼", "🌺", "🌷", "🌻"];
  const flags = ["🎌", "🏳️‍🌈", "🚩", "🏁", "🎏"];

  // Wave 1: confetti + flowers
  for (let index = 0; index < 100; index += 1) {
    const piece = document.createElement("div");
    const isFlower = index % 5 === 0;
    piece.className = `confetti-piece${isFlower ? " is-flower" : ""}`;
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDuration = `${3.2 + Math.random() * 2.8}s`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.setProperty("--drift", `${-140 + Math.random() * 280}px`);

    if (isFlower) {
      piece.textContent = flowers[index % flowers.length];
    } else {
      piece.style.background = palette[index % palette.length];
    }

    confettiLayer.append(piece);
  }

  // Wave 2: flags floating down
  for (let index = 0; index < 14; index += 1) {
    const flag = document.createElement("div");
    flag.className = "confetti-piece is-flower";
    flag.textContent = flags[index % flags.length];
    flag.style.left = `${5 + Math.random() * 90}%`;
    flag.style.fontSize = "1.8rem";
    flag.style.animationDuration = `${4 + Math.random() * 2}s`;
    flag.style.animationDelay = `${0.3 + Math.random() * 0.8}s`;
    flag.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
    confettiLayer.append(flag);
  }

  // Wave 3: firework bursts at random positions
  function spawnFirework(centerX, centerY, delay) {
    const burstColors = ["#ff4e6a", "#ffdd57", "#57c7ff", "#ff8f57", "#c957ff", "#57ffa0"];
    const particleCount = 24;

    for (let index = 0; index < particleCount; index += 1) {
      const spark = document.createElement("div");
      spark.className = "firework-spark";
      const angle = (index / particleCount) * 360;
      const distance = 60 + Math.random() * 80;
      spark.style.left = `${centerX}%`;
      spark.style.top = `${centerY}%`;
      spark.style.background = burstColors[index % burstColors.length];
      spark.style.setProperty("--fx", `${Math.cos((angle * Math.PI) / 180) * distance}px`);
      spark.style.setProperty("--fy", `${Math.sin((angle * Math.PI) / 180) * distance}px`);
      spark.style.animationDelay = `${delay}s`;
      confettiLayer.append(spark);
    }
  }

  spawnFirework(25, 30, 0.2);
  spawnFirework(75, 25, 0.6);
  spawnFirework(50, 45, 1.0);
  spawnFirework(15, 55, 1.4);
  spawnFirework(85, 50, 1.7);

  // Wave 4: second confetti burst after fireworks
  window.setTimeout(() => {
    for (let index = 0; index < 60; index += 1) {
      const piece = document.createElement("div");
      const isFlag = index % 7 === 0;
      piece.className = `confetti-piece${isFlag ? " is-flower" : ""}`;
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDuration = `${2.5 + Math.random() * 2}s`;
      piece.style.animationDelay = `${Math.random() * 0.3}s`;
      piece.style.setProperty("--drift", `${-100 + Math.random() * 200}px`);

      if (isFlag) {
        piece.textContent = flags[index % flags.length];
      } else {
        piece.style.background = palette[index % palette.length];
      }

      confettiLayer.append(piece);
    }
  }, 1200);

  window.setTimeout(() => {
    document.body.classList.remove("win-mode");
  }, 5000);
}

function appendGuessHistory(guess, roses, lillies) {
  state.history.unshift({
    type: "guess",
    guess,
    roses,
    lillies,
    label: `#${state.move}`,
  });
}

function appendFinalHistory(guess, resultText) {
  state.history.unshift({
    type: "final",
    guess,
    resultText,
    label: "final",
  });
}

function appendInfoHistory(resultText) {
  state.history.unshift({
    type: "final",
    guess: "----",
    resultText,
    label: "info",
  });
}

function cycleDigitMark(digit) {
  const current = state.digitMarks[digit];
  const nextIndex = (NOTE_STATES.indexOf(current) + 1) % NOTE_STATES.length;
  state.digitMarks[digit] = NOTE_STATES[nextIndex];
}

function buildHint() {
  const secret = state.secret;
  const secretDigits = [...secret];
  state.hintCount += 1;

  if (state.hintCount <= 2) {
    const digit = secretDigits[state.hintCount - 1];
    return `${digit} is 🪷`;
  }

  const roseIndex = state.hintCount - 3;
  if (roseIndex < 4) {
    const digit = secretDigits[roseIndex];
    return `${digit} is 🌹 at position ${roseIndex + 1}`;
  }

  return `The answer is ${secret}`;
}

function shakeDuplicates() {
  const values = actionInputs.map((input) => input.value.trim());
  const seen = {};
  const dupeIndices = new Set();

  values.forEach((val, index) => {
    if (!val) return;
    if (seen[val] !== undefined) {
      dupeIndices.add(seen[val]);
      dupeIndices.add(index);
    } else {
      seen[val] = index;
    }
  });

  dupeIndices.forEach((index) => {
    const input = actionInputs[index];
    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
    input.addEventListener("animationend", () => {
      input.classList.remove("shake");
    }, { once: true });
  });
}

function submitTry() {
  if (state.gameOver) {
    return;
  }

  const guess = readDigitInputs(actionInputs);
  const error = isValidGuess(guess);

  if (error === "no repeats") {
    shakeDuplicates();
    return;
  }

  if (error) {
    return;
  }

  const { roses, lillies } = scoreGuess(guess, state.secret);
  appendGuessHistory(guess, roses, lillies);

  if (roses === 4) {
    lockGame();
    celebrateWin();
    showWinDialog(state.move);
  } else {
    if (state.move >= MAX_TRIES) {
      appendFinalHistory(state.secret, "out of tries");
      lockGame();
    } else {
      state.move += 1;
    }
  }

  clearDigitInputs(actionInputs);
  renderAll();
  actionInputs[0].focus();
}

function submitSolve() {
  if (state.gameOver) {
    return;
  }

  const finalGuess = readDigitInputs(actionInputs);
  const error = isValidGuess(finalGuess);

  if (error === "no repeats") {
    shakeDuplicates();
    return;
  }

  if (error) {
    return;
  }

  if (finalGuess === state.secret) {
    appendFinalHistory(finalGuess, "win");
    lockGame();
    celebrateWin();
    showWinDialog(state.move - 1);
  } else {
    appendFinalHistory(finalGuess, `lose ${state.secret}`);
    lockGame();
  }

  clearDigitInputs(actionInputs);
  renderAll();
  actionInputs[0].focus();
}

actionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (event.submitter === solveButton) {
    submitSolve();
  } else {
    submitTry();
  }
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest(".digit-chip");
  if (!button) {
    return;
  }

  cycleDigitMark(button.dataset.digit);
  renderAll();
});

clearNotesButton.addEventListener("click", () => {
  resetMarks();
  renderAll();
});
hintButton.addEventListener("click", () => {
  if (state.gameOver) {
    return;
  }

  state.usedHints = true;
  appendInfoHistory(buildHint());
  renderAll();
});
showAnswerButton.addEventListener("click", () => {
  if (state.gameOver) {
    return;
  }

  state.usedHints = true;
  state.history.unshift({
    type: "final",
    guess: state.secret,
    resultText: "Answer",
    label: "info",
  });
  lockGame();
  renderAll();
});

newGameButton.addEventListener("click", startGame);
rulesButton.addEventListener("click", () => {
  rulesDialog.showModal();
});
closeRulesButton.addEventListener("click", () => {
  rulesDialog.close();
});
rulesDialog.addEventListener("click", (event) => {
  const rect = rulesDialog.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!inside) {
    rulesDialog.close();
  }
});
storyButton.addEventListener("click", () => {
  storyDialog.showModal();
});
closeStoryButton.addEventListener("click", () => {
  storyDialog.close();
});
storyDialog.addEventListener("click", (event) => {
  const rect = storyDialog.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!inside) {
    storyDialog.close();
  }
});

winForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = winNameInput.value.trim();
  if (!name) return;
  addLeaderboardEntry(name, state.move, state.history);
  winDialog.close();
  renderLeaderboard();
  leaderboardDialog.showModal();
});
winDialog.addEventListener("click", (event) => {
  const rect = winDialog.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) {
    winDialog.close();
  }
});
leaderboardButton.addEventListener("click", () => {
  renderLeaderboard();
  leaderboardDialog.showModal();
});
closeLeaderboardButton.addEventListener("click", () => {
  leaderboardDialog.close();
});
leaderboardDialog.addEventListener("click", (event) => {
  const rect = leaderboardDialog.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) {
    leaderboardDialog.close();
  }
});

wireDigitInputs(actionInputs);
applyTheme("forest-moss");
startGame();
