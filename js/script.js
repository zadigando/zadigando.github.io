document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", function () {
      menu.classList.toggle("active");
    });

    document.addEventListener("click", function (event) {
      if (!menu.contains(event.target) && !menuToggle.contains(event.target)) {
        menu.classList.remove("active");
      }
    });
  }
});

// 🔹 Verifica se a página possui um carrossel antes de executar o código
const carousel = document.querySelector(".carousel");
const slides = document.querySelectorAll(".carousel-image");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

if (carousel && slides.length > 0) {
  let currentIndex = 1;
  let autoSlideInterval;

  function showSlide(index) {
    if (!carousel) return; // 🔹 Evita erro se o carrossel não existir

    carousel.style.transition = "transform 0.5s ease-in-out";
    carousel.style.transform = `translateX(${-index * 100}%)`;
    currentIndex = index;

    setTimeout(() => {
      if (currentIndex >= slides.length - 1) {
        carousel.style.transition = "none";
        currentIndex = 1;
        carousel.style.transform = `translateX(${-currentIndex * 100}%)`;
      }
      if (currentIndex <= 0) {
        carousel.style.transition = "none";
        currentIndex = slides.length - 2;
        carousel.style.transform = `translateX(${-currentIndex * 100}%)`;
      }
    }, 500);

    resetAutoSlide();
  }

  function nextSlide() {
    showSlide(currentIndex + 1);
  }

  function prevSlide() {
    showSlide(currentIndex - 1);
  }

  function startAutoSlide() {
    autoSlideInterval = setInterval(() => {
      nextSlide();
    }, 5000);
  }

  function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    startAutoSlide();
  }

  startAutoSlide();

  if (prevBtn) {
    prevBtn.addEventListener("click", resetAutoSlide);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", resetAutoSlide);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const aboutSection = document.querySelector(".about");

  function checkVisibility() {
    const rect = aboutSection.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.75) {
      aboutSection.classList.add("show");
    }
  }

  window.addEventListener("scroll", checkVisibility);
  checkVisibility();
});

function startCounter() {
  const stats = document.querySelectorAll(".stat-number");

  stats.forEach((stat) => {
    let target = +stat.getAttribute("data-target");
    let count = 0;
    let increment = target / 100; // Ajuste para um incremento suave

    let updateCounter = setInterval(() => {
      count += increment;
      stat.innerText = Math.floor(count);

      if (count >= target) {
        stat.innerText = target;
        clearInterval(updateCounter);
      }
    }, 30); // Tempo entre cada incremento
  });
}

// Dispara a animação quando a seção "Sobre Mim" estiver visível
document.addEventListener("DOMContentLoaded", function () {
  const aboutSection = document.querySelector(".about");

  function checkVisibility() {
    const rect = aboutSection.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.75) {
      startCounter();
      window.removeEventListener("scroll", checkVisibility); // Evita reativar o contador
    }
  }

  window.addEventListener("scroll", checkVisibility);
  checkVisibility();
});
