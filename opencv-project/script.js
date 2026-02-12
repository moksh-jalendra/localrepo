let useremai = document.getElementById("a1");
let pass = document.getElementById("p1");

function Drag(ev) {
    ev.dataTransfer.setData("text",ev.target.id) ;
}

function dragovdrHandler(ev){
    ev.preventDefault();
}

function dropHandler(ev){
    ev.preventDefault();
    const data = ev.dataTransfer.getData('text');
    ev.target.appendChild(document.getElementById(data));
}