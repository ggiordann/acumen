document.addEventListener('DOMContentLoaded', () => {
    const animation = document.getElementById('animation');
    
    const sun = document.createElement('div');
    sun.className = 'sun';
    animation.appendChild(sun);

    for (let i = 0; i < 2; i++) {
        const planet = document.createElement('div');
        planet.className = 'planet';
        animation.appendChild(planet);
    }
});
