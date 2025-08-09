(function () {
  let draggingId = null;

  function makeDraggable(cardEl) {
    cardEl.setAttribute('draggable', 'true');
    cardEl.addEventListener('dragstart', (e) => {
      draggingId = cardEl.dataset.id;
      cardEl.classList.add('dragging');
      e.dataTransfer.setData('text/plain', draggingId);
      e.dataTransfer.effectAllowed = 'move';
    });
    cardEl.addEventListener('dragend', () => {
      draggingId = null;
      cardEl.classList.remove('dragging');
    });
  }

  function makeGridDroppable(gridEl, onReorder) {
    gridEl.addEventListener('dragover', (e) => {
      if (!draggingId) return;
      e.preventDefault();

      const afterEl = getDragAfterElement(gridEl, e.clientY, e.clientX);
      const draggingEl = gridEl.querySelector(`[data-id="${draggingId}"]`);
      if (!draggingEl) return;
      if (afterEl == null) {
        gridEl.appendChild(draggingEl);
      } else {
        gridEl.insertBefore(draggingEl, afterEl);
      }
    });

    gridEl.addEventListener('drop', (e) => {
      if (!draggingId) return;
      e.preventDefault();
      onReorder();
    });
  }

  // Approximate "closest next element" in a CSS grid by vertical proximity, then horizontal
  function getDragAfterElement(container, y, x) {
    const els = [...container.querySelectorAll('.card:not(.dragging)')];

    // Compute distance of each element's center to the cursor
    let best = null;
    let bestDist = Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dy = cy - y, dx = cx - x;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) { bestDist = dist; best = el; }
    }
    return best;
  }

  window.FavBoard = window.FavBoard || {};
  window.FavBoard.DnD = { makeDraggable, makeGridDroppable };
})();
