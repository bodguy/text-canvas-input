import TextInput from "./TextIntput";

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    const textInput = new TextInput("", (e) => { console.log("enter") }, canvas, context);

    function step() {
        textInput.render();
        window.requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
});