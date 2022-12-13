import TextInput from "./TextIntput";

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
    const context = canvas.getContext('2d');

    const mouse = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        window.mousePos = { x, y };
    }
    canvas.addEventListener('mousemove', mouse);

    const textInput = new TextInput({
        fontSize: 30,
        bounds: {
            x: 10,
            y: 250,
            w: 780,
            h: 15
        }
    }, canvas, context);

    const textInput2 = new TextInput({
        fontSize: 20,
        bounds: {
            x: 200,
            y: 400,
            w: 400,
            h: 15
        }
    }, canvas, context);

    const textInput3 = new TextInput({
        fontSize: 10,
        bounds: {
            x: 300,
            y: 500,
            w: 200,
            h: 15
        }
    }, canvas, context);

    let lastTime = 0;
    function step(currentTime: DOMHighResTimeStamp) {
        const deltaTime = (currentTime - lastTime) / 1000;
        context.clearRect(0, 0, canvas.width, canvas.height);
        textInput.render(deltaTime);
        textInput2.render(deltaTime);
        textInput3.render(deltaTime);
        lastTime = currentTime;
        window.requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
});