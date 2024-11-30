document.addEventListener('DOMContentLoaded', () => {
    const animation = document.getElementById('animation');
    for (let i = 0; i < 3; i++) {
        const orb = document.createElement('div');
        animation.appendChild(orb);
    }
});
