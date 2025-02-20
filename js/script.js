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

let currentIndex = 1; // Começa na primeira imagem real
const slides = document.querySelectorAll(".carousel-image");
const totalSlides = slides.length;
const carousel = document.querySelector(".carousel");
let autoSlideInterval; // Variável para armazenar o intervalo

function showSlide(index) {
    carousel.style.transition = "transform 0.5s ease-in-out";
    carousel.style.transform = `translateX(${-index * 100}%)`;
    currentIndex = index;

    // Resetando para um loop infinito sem transição visível
    setTimeout(() => {
        if (currentIndex >= totalSlides - 1) { 
            carousel.style.transition = "none"; // Remove a transição para resetar
            currentIndex = 1; // Retorna à primeira imagem real
            carousel.style.transform = `translateX(${-currentIndex * 100}%)`;
        }
        if (currentIndex <= 0) { 
            carousel.style.transition = "none"; // Remove a transição para resetar
            currentIndex = totalSlides - 2; // Retorna à última imagem real
            carousel.style.transform = `translateX(${-currentIndex * 100}%)`;
        }
    }, 500); // Tempo igual ao da transição

    resetAutoSlide(); // Reinicia o timer após interação
}

function nextSlide() {
    showSlide(currentIndex + 1);
}

function prevSlide() {
    showSlide(currentIndex - 1);
}

// Função para iniciar o carrossel automático
function startAutoSlide() {
    autoSlideInterval = setInterval(() => {
        nextSlide();
    }, 5000);
}

// Função para resetar o carrossel automático após interação
function resetAutoSlide() {
    clearInterval(autoSlideInterval); // Para o timer atual
    startAutoSlide(); // Inicia um novo timer de 5s
}

// Iniciar automaticamente quando a página carregar
startAutoSlide();

// Adicionar eventos de interação (qualquer clique nos botões)
document.querySelector(".prev").addEventListener("click", resetAutoSlide);
document.querySelector(".next").addEventListener("click", resetAutoSlide);


