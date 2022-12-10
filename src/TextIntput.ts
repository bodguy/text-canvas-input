class TextInput {

    private value: string;
    private selection: [number, number];
    private hiddenInput: HTMLInputElement;
    private isFocused: boolean;
    private isDrag: boolean;
    private fontSize: number;
    private color: {
        font: string,
        cursor: string,
        selection: string,
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
    private enterCallback: (event: KeyboardEvent) => void;

    constructor(defaultValue: string, onEnter: (event: KeyboardEvent) => void, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.context = context;
        this.enterCallback = onEnter;
        this.cursorFrequency = 500;

        this.selection = [0, 0];
        this.isFocused = false;
        this.isDrag = false;
        this.fontSize = 13;

        this.color = {
            font: 'black',
            cursor: 'black',
            selection: 'rgba(0, 0, 106, 0.5)'
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
        this.hiddenInput.addEventListener('paste', this.onPaste.bind(this));
        this.hiddenInput.addEventListener('cut', this.onCut.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this), true);
        window.addEventListener('mousedown', this.onMouseDown.bind(this), true);
        window.addEventListener('mouseup', this.onMouseUp.bind(this), true);
    }

    onKeyDown(event: KeyboardEvent) {
        const keyCode = event.which;

        if (event.ctrlKey || event.metaKey) {
            const isShift = event.shiftKey;

            switch (keyCode) {
                case 65: // A key
                    event.preventDefault();
                    this.selectAllText();
                    return;
                case 37: // left arrow
                    event.preventDefault();
                    this.setSelection(0, isShift ? this.selection[1] : 0);
                    return;
                case 39: // right arrow
                    event.preventDefault();
                    this.setSelection(
                        isShift ? this.selection[0] : this.value.length,
                        this.value.length
                    );
                    return;
                case 8: // backspace
                    event.preventDefault();
                    this.onRemoveBefore();
                    return;
            }
        }

        // enter key
        if (keyCode === 13) {
            this.onEnter(event);
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

    onPaste(event: ClipboardEvent) {
        event.preventDefault();
        this.appendValue(event.clipboardData.getData('text'));
    }

    onCut(event: ClipboardEvent) {
        event.preventDefault();
        event.clipboardData.setData('text/plain', document.getSelection().toString());
        const outside = this.getSelectionOutside();
        this.setValue(`${outside[0]}${outside[1]}`);
        this.setSelection(outside[0].length, outside[0].length);
    }

    onEnter(event: KeyboardEvent) {
        event.preventDefault();
        this.enterCallback(event);
    }

    onMouseMove(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mousePos.x = x;
        this.mousePos.y = y;

        if (this.isFocused && this.isDrag) {
            // TODO: back selection
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
            this.setSelection(curPos, curPos);
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
            if (this.selection[0] !== this.selection[1]) {
                const selectOffset = this.measureText(text.substring(0, this.selection[0]));
                const selectWidth = this.measureText(text.substring(this.selection[0], this.selection[1]));

                this.context.fillStyle = this.color.selection;
                this.context.fillRect(selectOffset + x, y, selectWidth, this.fontSize);
            } else {
                const cursorOffset = this.measureText(text.substring(0, this.selection[0]));
                this.context.fillStyle = this.color.cursor;
                this.context.fillRect(cursorOffset + x, y, 1, this.fontSize);
            }
        }

        const area = this.area();
        const textY = Math.round(y + this.fontSize / 2);

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
        // TODO: refresh cursor blink!
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

    private onRemoveBefore() {
        const remain = this.value.substring(this.selection[1], this.value.length);
        this.setValue(remain);
        this.setSelection(0, 0);
    }

    private appendValue(value: string) {
        const outside = this.getSelectionOutside();
        const lastCurPos = outside[0].length + value.length;
        this.setValue(`${outside[0]}${value}${outside[1]}`);
        this.setSelection(lastCurPos, lastCurPos);
    }

    private getSelectionOutside(): [string, string] {
        const before = this.value.substring(0, this.selection[0]);
        const after = this.value.substring(this.selection[1], this.value.length);
        return [before, after];
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