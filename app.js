
const CEL_SIZE = 6;

let PLAY_STATUS = 1;
let TO_INJECT = [];
let SHOW_GRID = true;
let GEN_TIME = 110;
let SUPER_GRID_SIZE = 22;
let SHOW_SUPER_GRID = true;
let activeGrids = null;

let state;

class Bitfield {

    constructor(size) {
        if (ArrayBuffer.isView(size)) {
            this._buffer = new Uint32Array(size.buffer);
        } else {
            this._buffer = new Uint32Array(Math.ceil(size / 32));
        }
    }

    clear() {
        this._buffer.fill(0x00);
    }

    get(x) {
        const word = this._buffer[(x / 32)|0];
        return !!(1 << (x % 32) & word);
    }

    set(x, val = true) {
        const oval = this._buffer[(x / 32)|0];
        const vb = val ? 4294967295 : 0;
        if (val) {
            this._buffer[(x / 32)|0] = oval | (1 << (x % 32));
        } else {
            this._buffer[(x / 32)|0] = oval & ~(1 << (x % 32));
        }
    }

    clone(buffer) {
        return new Bitfield(buffer);
    }
}

class Board {
    
    constructor(width, height, options = {}) {
        this._width = width;
        this._height = height;
        this._state = options.buffer || new Bitfield(width * height);
        if (!options.buffer) {
            this._state.clear();
        }
    }

    get state() {
        return this._state;
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    get(x, y) {
        x = x < 0 ? this.width - 1 : x % this.width;
        y = y < 0 ? this.height - 1 : y % this.height;
        const idx = (x * this._width) + (y % this._height);
        return this._state.get(idx);
    }

    set(x, y, val = true) {
        x = x < 0 ? this.width - x - 1 : x % this.width;
        y = y < 0 ? this.height - y - 1 : y % this.height;
        const idx = (x * this._width) + (y % this._height);
        this._state.set(idx, val);
    }

    update(cb) {
        const newBoard = new Board(this.width, this.height);
        this._state = cb(newBoard).state;
    }

    map(cb) {
        map:
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                if (cb(i, j, this.get(i, j)) === false) break map;
            }
        }
    }
}

class Game {

    constructor(elId, width = 100, height = 100, options = {}) {
        this._el = document.getElementById(elId);
        this._board = new Board(width, height);
        this._options = {
            celSize: 6,
            speed: 100,
            showGrid: true,
            ...options,
        };
        this._state = 1;
        this._el.width = width * this._options.celSize;
        this._el.height = height * this._options.celSize;
    }

    get board() {
        return this._board;
    }

    get context() {
        if (!this._options.context) {
            this._options.context = this._el.getContext('2d');
        }
        return this._options.context;
    }

    update() {
        if (this._state !== 1) {
            return;
        }

        this.board.update((newState) => {
            this.board.map((x, y, state) => {
                const lives = [
                    this.board.get(x - 1, y - 1),
                    this.board.get(x - 1, y),
                    this.board.get(x - 1, y + 1),
                    this.board.get(x, y - 1),
                    this.board.get(x, y + 1),
                    this.board.get(x +  1, y - 1),
                    this.board.get(x + 1, y),
                    this.board.get(x + 1, y + 1),
                ]
                    .reduce((t, cel) => t += cel ? 1 : 0, 0);

                if (state ? lives > 1 && lives < 4 : lives === 3) {
                    newState.set(x, y);
                }

            });

            return newState;
        });
    }

    drawBoard() {
        this.context.strokeStyle = 'red';
        this.context.rect(
            0,
            0,
            this.board.width * this._options.celSize,
            this.board.height * this._options.celSize,
        );
        this.context.stroke();
    }

    clearBoard() {
        const {width, height} = this.board;
        const {celSize} = this._options;

        this.context.clearRect(
            1,
            1,
            width * celSize - 2,
            height * celSize - 2,
        );

        if (this._options.showGrid) {
            this.context.beginPath();
            this.context.strokeStyle = '#555';

            for (let i = 1; i < width; i++) {
                this.context.moveTo(i * celSize,1);
                this.context.lineTo(i * celSize, (width * celSize) -1);
            }

            for (let i = 1; i < height; i++) {
                this.context.moveTo(1, i * celSize);
                this.context.lineTo((height * celSize) -1, i * celSize);
            }

            this.context.stroke();
        }
    }

    drawCel(x, y) {
        const {celSize} = this._options;
        const px = (x * celSize) + 1;
        const py = (y * celSize) + 1;
        const s = celSize - 2;
        this.context.fillStyle = 'white';
        this.context.fillRect(px, py, s, s);
    }

    render() {
        this.clearBoard();
        this.board.map((x, y, val) => {
            if (val) this.drawCel(x, y);
        });
    }

    asyncLoop() {
        const ts = Date.now();
        this.update();
        const tl = Date.now() - ts;
        setTimeout(() => {
            if (!this._state) return;
            this.asyncLoop();
        }, this._options.speed - tl);
    }

    renderLoop() {
        window.requestAnimationFrame(() => {
            this.render();
            this.renderLoop();
        });
    }

    start() {
        const px = (this.board.width / 2)|0;
        const py = (this.board.height / 2)|0;
        this.board.set(px, py - 1);
        this.board.set(px, py);
        this.board.set(px, py + 1);
        this.drawBoard();
        this.asyncLoop();
        this.renderLoop();
    }

    togglePause() {
        if (this._state === 1) {
            this._state = 2;
        } else {
            this._state = 1;
        }
    }

    toggleCel(x, y) {
        const val = this.board.get(x, y);
        this.board.set(x, y, !val);
    }
}

class GameControll {

    constructor(game) {
        this._game = game;
    }

    get game() {
        return this._game;
    }

    coordsToCel(x, y) {
        const {width, height} = this.game.board;
        const elWidth = this.game._el.offsetWidth;
        const elHeigth = this.game._el.offsetHeight;
        return [
            Math.floor(x / (elWidth / width)),
            Math.floor(y / (elHeigth / height)),
        ];
    }

    subscribeEvents() {

        this.game._el.addEventListener('click', (ev) => {
            let [x, y] = this.coordsToCel(
                event.pageX - this.game._el.offsetLeft,
                event.pageY - this.game._el.offsetTop
            );
            this.game.toggleCel(x, y);
        });

        window.addEventListener('keyup', (ev) => {
            if (ev.keyCode == 32) {
                this.game.togglePause();
            } else if (ev.keyCode == 77) {
                this.game._options.showGrid = !this.game._options.showGrid;
            }
        });
    }

}


document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game('screen', 150, 150);
    window.game.start();
    window.gameController = new GameControll(window.game);
    window.gameController.subscribeEvents();
});


    /*
function serialize(state) {
    const [width, height] = [state.length, state[0].length];
    const total = width * height;
    const hex = (v) => (`0${v.toString(16)}`).substr(-2);
    let result = [];

    const coords = (x) => [
        x % width,
        (x / height)|0,
    ];

    for (let i = 0; i < total; i++) {
        const [x, y] = coords(i);
        if (state[x][y]) {
            result.push([x,y]);
        }
    }

    return hex(width) + hex(height) + result.map(([x,y]) => hex(x) + hex(y)).join('');
}

function unserialize(serialized) {
    const blocks = serialized
        .match(/.{2}/g)
        .map((x) => parseInt(x, 16));

    const width = blocks.shift();
    const height = blocks.shift();
    const newState = new Array(width);

    for (let i = 0; i < width; i++) {
        newState[i] = new Array(height);
        for (let j = 0; j < height; j++) {
            newState[i][j] = 0;
        }
    }

    for (let i = 0; i < blocks.length; i+=2) {
        newState[i][i+1] = true;
    }

    return newState;
}
*/
