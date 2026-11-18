const ITEMS = {
  phone: { n: 'Phone', pts: 25, s: [[1], [1]] },
  lipstick: { n: 'Lipstick', pts: 10, s: [[1], [1]] },
  wallet: { n: 'Wallet', pts: 20, s: [[1, 1]] },
  keys: { n: 'Keys', pts: 10, s: [[1]] },
  earbuds: { n: 'Earbuds', pts: 10, s: [[1]] },
  charger: { n: 'Charger', pts: 5, s: [[1]] },
  trash: { n: 'Crumpled trash', pts: 0, junk: 1, s: [[1]] },
};

const LEVEL = {
  n: 'Clutch',
  w: 4,
  h: 3,
  time: 45,
  req: ['phone', 'lipstick', 'keys', 'wallet'],
  extra: ['earbuds', 'charger'],
  junk: ['trash'],
};

let items = [];
let selectedId = null;
let hoveredCell = null;
let isDone = false;
let timerId = null;
let timeLeft = 0;

const $ = (id) => document.getElementById(id);

const rotate = (matrix) =>
  matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());

const shape = (item) => {
  let matrix = ITEMS[item.key].s.map((row) => [...row]);

  for (let i = 0; i < item.rot; i += 1) {
    matrix = rotate(matrix);
  }

  return matrix;
};

const boxSize = (n) => `calc(var(--cs) * ${n} + 3px * ${n - 1})`;
const tileSize = (n) => `${n * 24}px`;
const formatTime = (totalSeconds) =>
  `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;

function svg(item, sizeFn) {
  const base = ITEMS[item.key].s;
  const width = base[0].length;
  const height = base.length;

  return `<img src="images/${item.key}.svg" alt="" style="width:${sizeFn(width)};height:${sizeFn(height)};transform:translate(-50%,-50%) rotate(${item.rot * 90}deg)">`;
}

function boardArt(item, position, cssClass) {
  const matrix = shape(item);

  return `<div class="art ${cssClass || ''}" style="left:calc((var(--cs) + 3px) * ${position.c});top:calc((var(--cs) + 3px) * ${position.r});width:${boxSize(matrix[0].length)};height:${boxSize(matrix.length)}">${svg(item, boxSize)}</div>`;
}

function start() {
  let id = 0;

  items = [
    ...LEVEL.req.map((key) => ({ key, req: 1 })),
    ...LEVEL.extra.map((key) => ({ key, req: 0 })),
    ...LEVEL.junk.map((key) => ({ key, req: 0 })),
  ]
    .sort(() => Math.random() - 0.5)
    .map((entry) => ({
      id: id += 1,
      key: entry.key,
      req: entry.req,
      junk: ITEMS[entry.key].junk ? 1 : 0,
      rot: 0,
      at: null,
    }));

  stopTimer();
  timeLeft = LEVEL.time;
  updateTimer();

  selectedId = null;
  hoveredCell = null;
  isDone = false;
  $('result').classList.remove('show');
  $('msg').textContent = 'Pick an item, then tap the bag to place it.';
  show('game');
  render();
}

function occupiedCells(skipId) {
  const cells = {};

  items.forEach((item) => {
    if (item.at && item.id !== skipId) {
      shape(item).forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
          if (value) {
            cells[`${item.at.r + rowIndex},${item.at.c + colIndex}`] = item.id;
          }
        });
      });
    }
  });

  return cells;
}

function originPoint(item, row, column) {
  const matrix = shape(item);

  return {
    r: row - Math.floor(matrix.length / 2),
    c: column - Math.floor(matrix[0].length / 2),
  };
}

function fits(item, origin) {
  const occupied = occupiedCells(item.id);

  return shape(item).every((row, rowIndex) =>
    row.every((value, colIndex) => {
      if (!value) {
        return true;
      }

      const y = origin.r + rowIndex;
      const x = origin.c + colIndex;

      return y >= 0 && x >= 0 && y < LEVEL.h && x < LEVEL.w && !occupied[`${y},${x}`];
    }),
  );
}

function render() {
  const grid = $('grid');
  grid.style.setProperty('--w', LEVEL.w);

  const previewCells = {};
  let validPlacement = false;
  let ghost = '';

  const selectedItem = items.find((item) => item.id === selectedId);

  if (selectedItem && hoveredCell) {
    const origin = originPoint(selectedItem, hoveredCell.r, hoveredCell.c);
    validPlacement = fits(selectedItem, origin);

    shape(selectedItem).forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value) {
          previewCells[`${origin.r + rowIndex},${origin.c + colIndex}`] = 1;
        }
      });
    });

    ghost = boardArt(selectedItem, origin, 'ghost');
  }

  let markup = '';

  for (let row = 0; row < LEVEL.h; row += 1) {
    for (let col = 0; col < LEVEL.w; col += 1) {
      let className = 'cell';

      if (previewCells[`${row},${col}`]) {
        className += validPlacement ? ' ok' : ' no';
      }

      markup += `<div class="${className}" data-r="${row}" data-c="${col}" role="gridcell"></div>`;
    }
  }

  markup += items.filter((item) => item.at).map((item) => boardArt(item, item.at)).join('') + ghost;
  grid.innerHTML = markup;

  const remainingItems = items.filter((item) => !item.at);
  $('tray').innerHTML = remainingItems.length
    ? remainingItems.map((item) => {
        const matrix = shape(item);

        return `<button class="item" data-id="${item.id}" aria-pressed="${item.id === selectedId}"><div class="mini" style="width:${tileSize(matrix[0].length)};height:${tileSize(matrix.length)}">${svg(item, tileSize)}</div><span class="nm">${ITEMS[item.key].n}</span>${item.req ? '<span class="req">MUST</span>' : ''}</button>`;
      }).join('')
    : '<span class="nm">Everything is packed!</span>';

  const requiredItems = items.filter((item) => item.req);
  const requiredPacked = requiredItems.filter((item) => item.at).length;

  $('reqTxt').textContent = `Must-pack: ${requiredPacked} of ${requiredItems.length}`;
  $('bar').style.width = `${(requiredPacked / requiredItems.length) * 100}%`;
  $('done').disabled = requiredPacked < requiredItems.length || isDone;
}

function placeAt(row, column) {
  const item = items.find((entry) => entry.id === selectedId);

  if (!item || isDone) {
    return;
  }

  const origin = originPoint(item, row, column);

  if (fits(item, origin)) {
    item.at = origin;
    selectedId = null;
    hoveredCell = null;
    $('msg').textContent = 'Packed.';
    render();

    if (items.filter((entry) => entry.req).every((entry) => entry.at)) {
      $('msg').textContent = 'Must-packs done. Add extras or finish.';
    }
  } else {
    $('msg').textContent = 'Doesn’t fit there. Try rotating it or another spot.';
    const targetCell = document.querySelector(`[data-r="${row}"][data-c="${column}"]`);

    if (targetCell) {
      targetCell.classList.add('shake');
    }
  }
}

$('grid').addEventListener('click', (event) => {
  const cell = event.target.closest('.cell');

  if (!cell || isDone) {
    return;
  }

  const row = +cell.dataset.r;
  const column = +cell.dataset.c;
  const occupiedId = occupiedCells()[`${row},${column}`];

  if (selectedId !== null) {
    placeAt(row, column);
    return;
  }

  if (occupiedId !== undefined) {
    startTimer();
    const pickedItem = items[occupiedId];
    pickedItem.at = null;
    selectedId = pickedItem.id;
    hoveredCell = { r: row, c: column };
    $('msg').textContent = `Picked up ${ITEMS[pickedItem.key].n}.`;
    render();
  }
});

$('grid').addEventListener('mouseover', (event) => {
  const cell = event.target.closest('.cell');

  if (!cell || selectedId === null) {
    return;
  }

  const nextCell = { r: +cell.dataset.r, c: +cell.dataset.c };

  if (!hoveredCell || hoveredCell.r !== nextCell.r || hoveredCell.c !== nextCell.c) {
    hoveredCell = nextCell;
    render();
  }
});

$('grid').addEventListener('mouseleave', () => {
  if (hoveredCell) {
    hoveredCell = null;
    render();
  }
});

$('tray').addEventListener('click', (event) => {
  const button = event.target.closest('.item');

  if (!button || isDone) {
    return;
  }

  startTimer();
  selectedId = +button.dataset.id;
  hoveredCell = null;
  $('msg').textContent = `${ITEMS[items[selectedId].key].n} selected. Tap the bag to place it.`;
  render();
});

function rotateSelected() {
  const item = items.find((entry) => entry.id === selectedId);

  if (!item) {
    return;
  }

  item.rot = (item.rot + 1) % 4;
  render();
}

$('rot').onclick = rotateSelected;
document.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') {
    rotateSelected();
  }
});

$('reset').onclick = start;
$('again').onclick = start;

function updateTimer() {
  const timer = $('timer');
  timer.textContent = `⏱ ${formatTime(Math.max(0, timeLeft))}`;
  timer.classList.toggle('low', timeLeft <= 10);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function startTimer() {
  if (timerId || isDone) {
    return;
  }

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateTimer();

    if (timeLeft <= 0) {
      timeUp();
    }
  }, 1000);
}

function timeUp() {
  stopTimer();
  isDone = true;
  selectedId = null;
  hoveredCell = null;
  render();

  $('stars').textContent = '☆☆☆';
  $('rTitle').textContent = 'Time’s up!';
  $('rText').textContent = 'The bag wasn’t packed in time. Try again, a little faster.';
  $('result').classList.add('show');
}

$('done').onclick = () => {
  stopTimer();
  isDone = true;
  selectedId = null;
  hoveredCell = null;

  const packedItems = items.filter((item) => item.at);
  const goodItems = packedItems.filter((item) => !item.junk);
  const junkCount = packedItems.length - goodItems.length;

  const baseScore = goodItems.reduce((total, item) => total + ITEMS[item.key].pts, 0);
  const bonus = Math.max(0, timeLeft) * 2;
  const penalty = junkCount * 25;
  const score = Math.max(0, baseScore + bonus - penalty);
  const extraItems = items.filter((item) => !item.req && !item.junk);
  const placedExtras = extraItems.filter((item) => item.at).length;

  let stars = placedExtras === extraItems.length ? 3 : placedExtras > 0 ? 2 : 1;

  if (junkCount) {
    stars = Math.max(1, stars - 1);
  }

  $('stars').textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
  $('rTitle').textContent = junkCount ? 'Bag closed, with junk' : stars === 3 ? 'Perfect pack!' : 'Bag closed!';
  $('rText').textContent = `Items +${baseScore}, time bonus +${bonus}${junkCount ? `, junk −${penalty}` : ''}. Total ${score} points.`;
  $('result').classList.add('show');
  render();
};

function show(nextScreen) {
  document.body.dataset.s = nextScreen;

  if (nextScreen !== 'game') {
    stopTimer();
  }

  window.scrollTo(0, 0);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-go]');

  if (button) {
    show(button.dataset.go);
  }
});

$('play').onclick = start;
$('gameBack').onclick = $('toMenu').onclick = () => {
  $('result').classList.remove('show');
  show('title');
};

show('title');
