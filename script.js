const username = "zadigando";
const apiUrl = `https://api.github.com/users/${username}/repos`;

async function fetchRepos() {
    const response = await fetch(apiUrl);
    const repos = await response.json();
    
    const container = document.getElementById("repos-container");
    container.innerHTML = "";

    repos.forEach(repo => {
        const repoElement = document.createElement("div");
        repoElement.classList.add("repo-card");

        repoElement.innerHTML = `
            <h2>${repo.name}</h2>
            <p>${repo.description || "Sem descrição"}</p>
            <p><strong>Linguagem:</strong> ${repo.language || "Desconhecida"}</p>
            <a href="${repo.html_url}" target="_blank">Ver no GitHub</a>
        `;

        container.appendChild(repoElement);
    });
}

fetchRepos();
