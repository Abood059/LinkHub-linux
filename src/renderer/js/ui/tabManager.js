export function initTabs(navItems, sections) {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId, navItems, sections);
        });
    });
}

export function switchTab(tabId, navItems, sections) {
    Object.values(sections).forEach(section => section?.classList.remove('active-section'));
    if (sections[tabId]) sections[tabId].classList.add('active-section');
    navItems.forEach(item => {
        const itemTab = item.getAttribute('data-tab');
        if (itemTab === tabId) item.classList.add('active');
        else item.classList.remove('active');
    });
}
