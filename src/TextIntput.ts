class TextInput {

    private value: string;
    private selection: [number, number];
    private hiddenInput: HTMLInputElement;
    private isFocused: boolean;
    private selectionStart: number;
    private fontSize: number;
    private maxLength: number;
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

    constructor(defaultValue: string, onEnter: (event: KeyboardEvent) => void, maxLength: number, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.context = context;
        this.enterCallback = onEnter;
        this.cursorFrequency = 500;

        this.selection = [0, 0];
        this.isFocused = false;
        this.selectionStart = -1;
        this.fontSize = 13;
        this.maxLength = maxLength;

        this.color = {
            font: 'black',
            cursor: 'black',
            selection: 'rgba(0, 0, 106, 1)'
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
        this.hiddenInput.maxLength = this.maxLength;
        this.hiddenInput.style.opacity = '0';
        this.hiddenInput.style.zIndex = '0';
        this.hiddenInput.style.cursor = 'none';
        this.hiddenInput.style.transform = 'scale(0)';
        this.hiddenInput.style.pointerEvents = 'none';
        this.setValue(defaultValue);
        document.body.appendChild(this.hiddenInput);

        this.hiddenInput.addEventListener('keydown', this.onKeyDown.bind(this));
        this.hiddenInput.addEventListener('keyup', this.onKeyUp.bind(this));
        this.hiddenInput.addEventListener('paste', this.onPaste.bind(this));
        this.hiddenInput.addEventListener('cut', this.onCut.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this), true);
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this), true);
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this), true);
        canvas.addEventListener('dblclick', this.onDoubleClick.bind(this), true);
    }

    onKeyDown(event: KeyboardEvent) {
        const keyCode = event.which;

        if (event.ctrlKey || event.metaKey) {
            switch (keyCode) {
                case 65: // A key
                    event.preventDefault();
                    this.selectAllText();
                    return;
                case 37: // left arrow
                    event.preventDefault();
                    this.setSelection(0, event.shiftKey ? this.selection[1] : 0);
                    return;
                case 39: // right arrow
                    event.preventDefault();
                    this.setSelection(
                        event.shiftKey ? this.selection[0] : this.value.length,
                        this.value.length
                    );
                    return;
                case 8: // backspace
                    event.preventDefault();
                    this.onRemoveBefore();
                    return;
                case 90: // z
                    event.preventDefault();
                    // TODO: rollback 처리
                    console.log('z');
                    return;
            }
        }

        switch (keyCode) {
            case 13: // enter key
                this.onEnter(event);
                break;
            case 37: // left arrow
                this.onLeft(event);
                break;
            case 39: // right arrow
                this.onRight(event);
                break;
        }

        const target = event.target as HTMLInputElement;
        this.setValue(target.value);
        this.setSelection(target.selectionStart, target.selectionEnd);
    }

    onKeyUp(event: Event) {
        const target = event.target as HTMLInputElement;
        this.setValue(target.value);
        this.setSelection(target.selectionStart, target.selectionEnd);
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

    onLeft(event: KeyboardEvent) {
        // TODO: left, right 선택시, 양쪽 이동현상 제거
        event.preventDefault();

        if (this.isSelected() && !event.shiftKey) {
            this.setSelection(this.selection[0], this.selection[0]);
            return;
        }

        const prevCurPos = this.clamp(this.selection[0] - 1, 0, this.value.length);

        this.setSelection(
            prevCurPos,
            event.shiftKey ? this.selection[1] : prevCurPos
        );
    }

    onRight(event: KeyboardEvent) {
        event.preventDefault();

        if (this.isSelected() && !event.shiftKey) {
            this.setSelection(this.selection[1], this.selection[1]);
            return;
        }

        const nextCurPos = this.clamp(this.selection[1] + 1, 0, this.value.length);

        this.setSelection(
            event.shiftKey ? this.selection[0] : nextCurPos,
            nextCurPos
        );
    }

    onMouseMove(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mousePos.x = x;
        this.mousePos.y = y;

        if (this.isFocused && this.selectionStart >= 0) {
            const curPos = this.clickPos(this.mousePos.x, this.mousePos.y);
            const start = Math.min(this.selectionStart, curPos);
            const end = Math.max(this.selectionStart, curPos);

            this.setSelection(start, end);
        }
    }

    onMouseDown(event: MouseEvent) {
        event.preventDefault();

        if (this.contains(this.mousePos.x, this.mousePos.y)) {
            this.setFocus(true);

            const curPos = this.clickPos(this.mousePos.x, this.mousePos.y);
            this.setSelection(curPos, curPos);
            this.selectionStart = curPos;

            return;
        }

        this.setFocus(false);
    }

    onMouseUp(event: MouseEvent) {
        this.selectionStart = -1;
    }

    onDoubleClick(event: MouseEvent) {
        event.preventDefault();

        if (this.contains(this.mousePos.x, this.mousePos.y)) {
            // TODO: ,.;:/[]- selection
            this.setSelection(0, this.value.length);
        }
    }

    render(deltaTime: number) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const x = this.bounds.x + this.padding.left + this.border.left;
        const y = this.bounds.y + this.padding.top + this.border.top;
        const text = this.clipText();

        if (this.isFocused) {
            if (this.isSelected()) {
                const selectOffset = this.measureText(text.substring(0, this.selection[0]));
                const selectWidth = this.measureText(text.substring(this.selection[0], this.selection[1]));

                this.context.fillStyle = this.color.selection;
                this.context.fillRect(selectOffset + x, y, selectWidth, this.fontSize);
            } else {
                if (Math.floor(Date.now() / this.cursorFrequency) % 2) {
                    const cursorOffset = this.measureText(text.substring(0, this.selection[0]));
                    this.context.fillStyle = this.color.cursor;
                    this.context.fillRect(cursorOffset + x, y, 1, this.fontSize);
                }
            }
        }

        const area = this.area();
        const textY = Math.round(y + this.fontSize / 2);

        this.context.font = `${this.fontSize}px monospace`;
        this.context.textAlign = 'left';
        this.context.textBaseline = 'middle';

        // TODO: clip text 넘어갈시 버그 수정
        const [before, after] = this.getSelectionOutside();
        const selectionText = this.value.substring(this.selection[0], this.selection[1]);
        this.context.fillStyle = this.color.font;
        this.context.fillText(before, x, textY);
        this.context.fillStyle = 'white';
        this.context.fillText(selectionText, x + this.measureText(before), textY);
        this.context.fillStyle = this.color.font;
        this.context.fillText(after, x + this.measureText(before + selectionText), textY);

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

    setMaxLength(value: number) {
        this.hiddenInput.maxLength = value;
        this.maxLength = value;
    }

    private onRemoveBefore() {
        if (this.isSelected()) {
            const [before, after] = this.getSelectionOutside();
            this.setValue(before + after);
            this.setSelection(before.length, before.length);
            return;
        }

        const remain = this.value.substring(this.selection[1], this.value.length);
        this.setValue(remain);
        this.setSelection(0, 0);
    }

    private appendValue(value: string) {
        const [before, after] = this.getSelectionOutside();
        const lastCurPos = before.length + value.length;
        this.setValue(before + value + after);
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
        // TODO: clip 됬을 때, 커서 이동 처리
        const value = this.value;
        const width = this.measureText(value);
        const fillPercent = width / (this.bounds.w - this.padding.left);
        const text = fillPercent > 1
            ? value.substr(-1 * Math.floor(value.length / fillPercent))
            : value;

        return text;
    }

    private isSelected(): boolean {
        return this.selection[0] !== this.selection[1];
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