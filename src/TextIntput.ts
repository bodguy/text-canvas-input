class TextInput {

    private value: string;
    private selection: [number, number];
    private hiddenInput: HTMLInputElement;
    private isFocused: boolean;
    private isHover: boolean;
    private isDrag: boolean;
    private fontSize: number;
    private color: {
        font: string,
        cursor: string,
        selection: string,
        hover: string
    }
    private bounds: {
        x: number,
        y: number,
        w: number,
        h: number
    };
    private padding: {
        top: number,
        left: number,
        right: number,
        bottom: number
    };
    private border: {
        top: number,
        left: number,
        right: number,
        bottom: number
    };
    private mousePos: { x: number, y: number };
    private cursorFrequency: number;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;

    constructor(defaultValue: string, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.context = context;
        this.cursorFrequency = 500;

        this.selection = [0, 0];
        this.isFocused = false;
        this.isHover = false;
        this.isDrag = false;
        this.fontSize = 13;

        this.color = {
            font: 'black',
            cursor: 'black',
            selection: 'rgba(0, 0, 106, 0.5)',
            hover: 'rgba(0, 0, 0, 0.05)'
        };

        this.bounds = {
            x: 320,
            y: 320,
            w: 300,
            h: 15
        };

        this.padding = {
            top: 1,
            left: 1,
            right: 1,
            bottom: 2
        };

        this.border = {
            top: 1,
            left: 1,
            right: 1,
            bottom: 1
        };

        this.mousePos = {
            x: 0,
            y: 0
        };

        this.hiddenInput = document.createElement('input') as HTMLInputElement;
        this.hiddenInput.type = 'text';
        this.hiddenInput.style.position = 'absolute';
        this.hiddenInput.style.left = '326px';
        this.hiddenInput.style.top = '350px';
        this.hiddenInput.style.width = '296px';
        this.hiddenInput.style.height = '14px';
        this.hiddenInput.style.fontFamily = 'monospace';
        // this.hiddenInput.style.opacity = '0';
        // this.hiddenInput.style.zIndex = '0';
        // this.hiddenInput.style.cursor = 'none';
        // this.hiddenInput.style.transform = 'scale(0)';
        // this.hiddenInput.style.pointerEvents = 'none';
        this.setValue(defaultValue);
        document.body.appendChild(this.hiddenInput);

        this.hiddenInput.addEventListener('keydown', this.onKeyDown.bind(this));
        this.hiddenInput.addEventListener('keyup', this.onKeyUp.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this), true);
        window.addEventListener('mousedown', this.onMouseDown.bind(this), true);
        window.addEventListener('mouseup', this.onMouseUp.bind(this), true);
    }

    onKeyDown(event: KeyboardEvent) {
        const keyCode = event.which;
        const isShift = event.shiftKey;

        // Ctrl/Cmd + A
        if (keyCode === 65 && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.selectAllText();
            return;
        }

        if (event.metaKey || event.ctrlKey) {
            event.preventDefault();

            // left: 37
            if (keyCode === 37) {
                this.selection[0] = 0;

                if (isShift) {
                    this.setSelection(0, this.selection[0]);
                }
            } else if (keyCode === 39) { // right: 39
                this.selection[1] = this.value.length;

                if (isShift) {
                    this.setSelection(this.selection[0], this.selection[1]);
                }
            } else if (keyCode === 8) { // backspace: 8
                this.value = '';
                this.selection = [0, 0];
            }
            return;
        }

        // enter key
        if (keyCode === 13) {
            event.preventDefault();
            console.log('enter key');
        } else if (keyCode === 9) { // tab key
            event.preventDefault();
            console.log('tab key');
        }

        const target = event.target as HTMLInputElement;
        this.value = target.value;
        this.selection = [target.selectionStart, target.selectionEnd];
    }

    onKeyUp(event: Event) {
        const target = event.target as HTMLInputElement;
        this.value = target.value;
        this.selection = [target.selectionStart, target.selectionEnd];
    }

    onMouseMove(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mousePos.x = x;
        this.mousePos.y = y;

        if (this.contains(this.mousePos.x, this.mousePos.y)) {
            this.isHover = true;
            this.canvas.style.cursor = 'text';
        } else {
            this.isHover = false;
            this.canvas.style.cursor = 'default';
        }

        if (this.isFocused && this.isDrag) {
            const curPos = this.clickPos(this.mousePos.x, this.mousePos.y);
            const start = this.clamp(curPos, 0, this.selection[0]);
            const end = this.clamp(curPos, this.selection[0], this.value.length);

            this.setSelection(start, end);
        }
    }

    onMouseDown(event: MouseEvent) {
        event.preventDefault();

        if (this.contains(this.mousePos.x, this.mousePos.y)) {
            this.setFocus(true);

            const curPos = this.clickPos(this.mousePos.x, this.mousePos.y);
            this.hiddenInput.selectionStart = curPos;
            this.hiddenInput.selectionEnd = curPos;
            this.selection = [curPos, curPos];
            this.isDrag = true;
            return;
        }
        
        this.setFocus(false);
    }

    onMouseUp(event: MouseEvent) {
        this.isDrag = false;
    }

    render() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const x = this.bounds.x + this.padding.left + this.border.left;
        const y = this.bounds.y + this.padding.top + this.border.top;
        const text = this.clipText();

        if (this.isFocused) {
            if (this.selection[1] > 0) {
                const selectOffset = this.measureText(text.substring(0, this.selection[0]));
                const selectWidth = this.measureText(text.substring(this.selection[0], this.selection[1]));

                this.context.fillStyle = this.color.selection;
                this.context.fillRect(selectOffset + x, y, selectWidth, this.fontSize);
            }

            if (Math.floor(Date.now() / this.cursorFrequency) % 2) {
                const cursorOffset = this.measureText(text.substring(0, this.selection[0]));
                this.context.fillStyle = this.color.cursor;
                this.context.fillRect(cursorOffset + x, y, 1, this.fontSize);
            }
        }

        const area = this.area();
        const textY = Math.round(y + this.fontSize / 2);

        if (!this.isFocused && this.isHover) {
            this.context.fillStyle = this.color.hover;
            this.context.fillRect(area.x, area.y, area.w, area.h);
        }

        this.context.fillStyle = this.color.font;
        this.context.font = `${this.fontSize}px monospace`;
        this.context.textAlign = 'left';
        this.context.textBaseline = 'middle';
        this.context.fillText(text, x, textY);

        this.drawRect(area.x, area.y, area.w, area.h);
    }

    setValue(value: string) {
        this.hiddenInput.value = value;
        this.value = value;
    }

    setSelection(start: number, end: number) {
        this.selection[0] = start;
        this.selection[1] = end;
        this.hiddenInput.selectionStart = start;
        this.hiddenInput.selectionEnd = end;
    }

    setFocus(focus: boolean) {
        if (focus) {
            this.isFocused = true;
            this.hiddenInput.focus();
        } else {
            this.isFocused = false;
            this.hiddenInput.blur();
        }
    }

    private contains(x: number, y: number) {
        const area = this.area();
        return x >= area.x &&
            x <= (this.bounds.x + area.w) &&
            y >= area.y &&
            y <= (this.bounds.y + area.h);
    }

    private area() {
        return {
            x: this.bounds.x - this.padding.left - this.border.left,
            y: this.bounds.y - this.padding.top - this.border.top,
            w: this.bounds.w + this.padding.right + this.border.right,
            h: this.bounds.h + this.padding.bottom + this.border.bottom
        }
    }

    private clickPos(x: number, y: number) {
        const boundX = x - this.area().x;
        const text = this.clipText();
        let totalWidth = 0;
        let pos = text.length;

        if (boundX < this.measureText(text)) {
            for (let i = 0; i < text.length; i++) {
                totalWidth += this.measureText(text[i]);
                if (totalWidth >= boundX) {
                    pos = i;
                    break;
                }
            }
        }

        return pos;
    }

    private drawRect(x: number, y: number, w: number, h: number) {
        this.context.beginPath();

        if (this.isFocused) {
            this.context.strokeStyle = 'red';
        } else {
            this.context.strokeStyle = 'black';
        }

        this.context.lineWidth = this.border.left;
        this.context.moveTo(x + 0.5, y + 0.5);
        this.context.lineTo(x + 0.5, y + h + 0.5);

        this.context.lineWidth = this.border.right;
        this.context.moveTo(x + w + 0.5, y + 0.5);
        this.context.lineTo(x + w + 0.5, y + h + 0.5);

        this.context.lineWidth = this.border.top;
        this.context.moveTo(x + 0.5, y + 0.5);
        this.context.lineTo(x + w + 0.5, y + 0.5);

        this.context.lineWidth = this.border.bottom;
        this.context.moveTo(x + 0.5, y + h + 0.5);
        this.context.lineTo(x + w + 0.5, y + h + 0.5);

        this.context.stroke();
    }

    private clipText() {
        const value = this.value;
        const width = this.measureText(value);
        const fillPercent = width / (this.bounds.w);
        const text = fillPercent > 1
            ? value.substr(-1 * Math.floor(value.length / fillPercent))
            : value;

        return text;
    }

    private measureText(text: string) {
        return this.context.measureText(text).width;
    }

    private selectAllText() {
        this.setSelection(0, this.value.length);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }
}

export default TextInput;