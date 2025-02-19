document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".header-main");

    if (!menuToggle || !menu) {
        console.error("Elemento do menu não encontrado!");
        return;
    }

    menuToggle.addEventListener("click", function () {
        menu.classList.toggle("active");
    });

    // Fechar menu ao clicar fora dele
    document.addEventListener("click", function (event) {
        if (!menu.contains(event.target) && !menuToggle.contains(event.target)) {
            menu.classList.remove("active");
        }
    });
});
