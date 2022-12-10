import TextInput from "./TextIntput";

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    const textInput = new TextInput("", (e) => { console.log("enter") }, 100, canvas, context);

    let lastTime = 0;
    function step(currentTime: DOMHighResTimeStamp) {
        const deltaTime = (currentTime - lastTime) / 1000;
        textInput.render(deltaTime);
        lastTime = currentTime;
        window.requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
});