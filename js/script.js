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
