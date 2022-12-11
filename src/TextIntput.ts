class TextInput {

    private static delimiter: string = " ,.;:/[]-\\?";
    private static defaultSettings = {
        fontColor: 'black',
        cursorColor: 'black',
        selectionColor: 'rgba(0, 0, 106, 1)',
        boxColor: 'grey',
        fontSize: 13,
        maxLength: -1,
        caretBlinkRate: 0.5,
        defaultValue: '',
        bounds: {
            x: 10,
            y: 250,
            w: 780,
            h: 15
        },
        padding: {
            top: 1,
            left: 1,
            right: 1,
            bottom: 2
        },
        border: {
            top: 1,
            left: 1,
            right: 1,
            bottom: 1
        },
        enterCallback: (event: KeyboardEvent) => {}
    }

    private value: string;
    private selection: [number, number];
    private hiddenInput: HTMLInputElement;
    private isFocused: boolean;
    private selectionStart: number;
    private blinkTimer: number;
    private mousePos: { x: number, y: number };
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private settings: typeof TextInput.defaultSettings;

    constructor(settings: Partial<typeof TextInput.defaultSettings>, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.context = context;
        this.selection = [0, 0];
        this.isFocused = false;
        this.selectionStart = -1;
        this.blinkTimer = 0;
        this.mousePos = { x: 0, y: 0 };
        this.settings = Object.assign(TextInput.defaultSettings, settings);
        this.settings.bounds.h = this.settings.fontSize + 2;
        
        this.hiddenInput = document.createElement('input') as HTMLInputElement;
        this.hiddenInput.type = 'text';
        this.hiddenInput.style.position = 'absolute';
        this.hiddenInput.style.opacity = '0';
        this.hiddenInput.style.zIndex = '0';
        this.hiddenInput.style.cursor = 'none';
        this.hiddenInput.style.transform = 'scale(0)';
        this.hiddenInput.style.pointerEvents = 'none';
        this.setValue(this.settings.defaultValue);
        this.setMaxLength(this.settings.maxLength);
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
                    this.onUndo(event);
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

    onUndo(event: Event) {
        event.preventDefault();
        console.log("not implemented yet");
    }

    onPaste(event: ClipboardEvent) {
        event.preventDefault();
        this.appendValue(event.clipboardData.getData('text'));
    }

    onCut(event: ClipboardEvent) {
        event.preventDefault();
        event.clipboardData.setData('text/plain', document.getSelection().toString());
        const [before, after] = this.getSelectionOutside();
        this.setValue(before + after);
        this.setSelection(before.length, before.length);
    }

    onEnter(event: KeyboardEvent) {
        event.preventDefault();
        this.settings.enterCallback(event);
    }

    onLeft(event: KeyboardEvent) {
        // TODO: left, right 선택시, 양쪽 이동현상 제거
        event.preventDefault();
        const altKey = event.altKey;

        if (this.isSelected() && !event.shiftKey) {
            this.setSelection(this.selection[0], this.selection[0]);
            return;
        }

        const prevCurPos = altKey ? 
            this.getNearestTermIndex(this.selection[0])[0] 
            : this.clamp(this.selection[0] - 1, 0, this.value.length);

        this.setSelection(
            prevCurPos,
            event.shiftKey ? this.selection[1] : prevCurPos
        );
    }

    onRight(event: KeyboardEvent) {
        event.preventDefault();
        const altKey = event.altKey;

        if (this.isSelected() && !event.shiftKey) {
            this.setSelection(this.selection[1], this.selection[1]);
            return;
        }

        const nextCurPos = altKey ? 
            this.getNearestTermIndex(this.selection[1])[1] 
            : this.clamp(this.selection[1] + 1, 0, this.value.length);

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
        const leftButton = event.button === 0;

        if (leftButton && this.contains(this.mousePos.x, this.mousePos.y)) {
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
        const leftButton = event.button === 0;

        if (leftButton && this.contains(this.mousePos.x, this.mousePos.y)) {
            const curPos = this.clickPos(this.mousePos.x, this.mousePos.y);
            const [start, end] = this.getNearestTermIndex(curPos);
            this.setSelection(start, end);
        }
    }

    getNearestTermIndex(pos: number): [number, number] {
        let start = 0;
        let end = this.value.length;

        for (let i = pos - 1; i > 0; i--) {
            if (TextInput.delimiter.includes(this.value[i])) {
                start = i;
                break;
            }
        }

        for (let i = pos + 1; i < this.value.length; i++) {
            if (TextInput.delimiter.includes(this.value[i])) {
                end = i;
                break;
            }
        }

        return [start, end];
    }

    render(deltaTime: number) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.blinkTimer += deltaTime;
        
        const x = this.settings.bounds.x + this.settings.padding.left + this.settings.border.left;
        const y = this.settings.bounds.y + this.settings.padding.top + this.settings.border.top;

        if (this.isFocused) {
            if (this.isSelected()) {
                const selectOffset = this.measureText(this.value.substring(0, this.selection[0]));
                const selectWidth = this.measureText(this.value.substring(this.selection[0], this.selection[1]));

                this.context.fillStyle = this.settings.selectionColor;
                this.context.fillRect(selectOffset + x, y, selectWidth, this.settings.fontSize);
            } else {
                if (Math.floor(this.blinkTimer / this.settings.caretBlinkRate) % 2) {
                    const cursorOffset = this.measureText(this.value.substring(0, this.selection[0]));
                    this.context.fillStyle = this.settings.cursorColor;
                    this.context.fillRect(cursorOffset + x, y, 1, this.settings.fontSize);
                }
            }
        }

        const area = this.area();
        const textY = Math.round(y + this.settings.fontSize / 2);

        this.context.font = `${this.settings.fontSize}px monospace`;
        this.context.textAlign = 'left';
        this.context.textBaseline = 'middle';

        const [before, after] = this.getSelectionOutside();
        const selectionText = this.value.substring(this.selection[0], this.selection[1]);
        this.context.fillStyle = this.settings.fontColor;
        this.context.fillText(before, x, textY);
        this.context.fillStyle = 'white';
        this.context.fillText(selectionText, x + this.measureText(before), textY);
        this.context.fillStyle = this.settings.fontColor;
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
        this.blinkTimer = this.settings.caretBlinkRate;
    }

    setFocus(focus: boolean) {
        if (focus) {
            this.isFocused = true;
            this.hiddenInput.focus();
        } else {
            this.setSelection(0, 0);
            this.isFocused = false;
            this.hiddenInput.blur();
        }
    }

    setMaxLength(value: number) {
        if (value !== -1) {
            this.hiddenInput.maxLength = value;
            this.settings.maxLength = value;
        }
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
            x <= (this.settings.bounds.x + area.w) &&
            y >= area.y &&
            y <= (this.settings.bounds.y + area.h);
    }

    private area() {
        return {
            x: this.settings.bounds.x - this.settings.padding.left - this.settings.border.left,
            y: this.settings.bounds.y - this.settings.padding.top - this.settings.border.top,
            w: this.settings.bounds.w + this.settings.padding.right + this.settings.border.right,
            h: this.settings.bounds.h + this.settings.padding.bottom + this.settings.border.bottom
        }
    }

    private clickPos(x: number, y: number) {
        const boundX = x - this.area().x;
        let totalWidth = 0;
        let pos = this.value.length;

        if (boundX < this.measureText(this.value)) {
            for (let i = 0; i < this.value.length; i++) {
                totalWidth += this.measureText(this.value[i]);
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

        this.context.strokeStyle = this.isFocused ? this.settings.boxColor : 'black';

        this.context.lineWidth = this.settings.border.left;
        this.context.moveTo(x + 0.5, y + 0.5);
        this.context.lineTo(x + 0.5, y + h + 0.5);

        this.context.lineWidth = this.settings.border.right;
        this.context.moveTo(x + w + 0.5, y + 0.5);
        this.context.lineTo(x + w + 0.5, y + h + 0.5);

        this.context.lineWidth = this.settings.border.top;
        this.context.moveTo(x + 0.5, y + 0.5);
        this.context.lineTo(x + w + 0.5, y + 0.5);

        this.context.lineWidth = this.settings.border.bottom;
        this.context.moveTo(x + 0.5, y + h + 0.5);
        this.context.lineTo(x + w + 0.5, y + h + 0.5);

        this.context.stroke();
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