document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("menu");

    // 🔹 Alternar visibilidade ao clicar no botão hamburguer
    menuToggle.addEventListener("click", function () {
        menu.classList.toggle("active");
    });

    // 🔹 Fechar menu ao clicar fora dele
    document.addEventListener("click", function (event) {
        if (!menu.contains(event.target) && !menuToggle.contains(event.target)) {
            menu.classList.remove("active");
        }
    });
});
