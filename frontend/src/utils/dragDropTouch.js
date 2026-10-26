/**
 * DragDropTouch - Polyfill leve e modular para suporte a Drag and Drop HTML5 em dispositivos touch.
 * Permite arrastar cards no Kanban com toque/dedo mantendo compatibilidade com os eventos nativos.
 */

class DataTransferTouch {
  constructor() {
    this.data = {};
    this.dropEffect = 'move';
    this.effectAllowed = 'all';
    this.types = [];
  }

  setData(format, data) {
    this.data[format.toLowerCase()] = data;
    if (!this.types.includes(format.toLowerCase())) {
      this.types.push(format.toLowerCase());
    }
  }

  getData(format) {
    return this.data[format.toLowerCase()] || '';
  }

  clearData(format) {
    if (format) {
      delete this.data[format.toLowerCase()];
      this.types = this.types.filter((t) => t !== format.toLowerCase());
    } else {
      this.data = {};
      this.types = [];
    }
  }
}

class DragDropTouchManager {
  constructor() {
    this.dragSource = null;
    this.dragDataTransfer = null;
    this.dragGhost = null;
    this.startTouch = null;
    this.lastTarget = null;
    this.isDragging = false;
    this.dragThreshold = 8; // pixels para distinguir toque/scroll de arrasto
  }

  init() {
    if (typeof window === 'undefined') return;

    window.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    window.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    window.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
  }

  handleTouchStart(e) {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const draggable = touch.target.closest('[draggable="true"]');
    if (!draggable) return;

    this.dragSource = draggable;
    this.startTouch = { x: touch.clientX, y: touch.clientY };
    this.isDragging = false;
  }

  handleTouchMove(e) {
    if (!this.dragSource || !this.startTouch) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - this.startTouch.x);
    const deltaY = Math.abs(touch.clientY - this.startTouch.y);

    if (!this.isDragging) {
      if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
        this.isDragging = true;
        this.dragDataTransfer = new DataTransferTouch();

        // Dispara dragstart
        const dragEvent = this.createDragEvent('dragstart', this.dragSource, touch);
        this.dragSource.dispatchEvent(dragEvent);

        // Cria imagem fantasma (ghost)
        this.createGhost(this.dragSource, touch);
      } else {
        return;
      }
    }

    if (this.isDragging) {
      e.preventDefault();

      if (this.dragGhost) {
        this.dragGhost.style.left = `${touch.clientX - 25}px`;
        this.dragGhost.style.top = `${touch.clientY - 25}px`;
      }

      // Detecta elemento sob o dedo
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elem && elem !== this.lastTarget) {
        if (this.lastTarget) {
          const leaveEvent = this.createDragEvent('dragleave', this.lastTarget, touch);
          this.lastTarget.dispatchEvent(leaveEvent);
        }
        this.lastTarget = elem;
        const enterEvent = this.createDragEvent('dragenter', elem, touch);
        elem.dispatchEvent(enterEvent);
      }

      if (elem) {
        const overEvent = this.createDragEvent('dragover', elem, touch);
        elem.dispatchEvent(overEvent);
      }
    }
  }

  handleTouchEnd(e) {
    if (!this.isDragging || !this.dragSource) {
      this.reset();
      return;
    }

    e.preventDefault();
    const touch = e.changedTouches[0];
    const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);

    if (dropTarget) {
      const dropEvent = this.createDragEvent('drop', dropTarget, touch);
      dropTarget.dispatchEvent(dropEvent);
    }

    const endEvent = this.createDragEvent('dragend', this.dragSource, touch);
    this.dragSource.dispatchEvent(endEvent);

    this.reset();
  }

  handleTouchCancel() {
    if (this.isDragging && this.dragSource) {
      const endEvent = this.createDragEvent('dragend', this.dragSource, { clientX: 0, clientY: 0 });
      this.dragSource.dispatchEvent(endEvent);
    }
    this.reset();
  }

  createDragEvent(type, target, touch) {
    const event = new CustomEvent(type, { bubbles: true, cancelable: true });
    event.dataTransfer = this.dragDataTransfer;
    event.clientX = touch.clientX;
    event.clientY = touch.clientY;
    event.pageX = touch.clientX;
    event.pageY = touch.clientY;
    return event;
  }

  createGhost(element, touch) {
    if (this.dragGhost) this.dragGhost.remove();

    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.75';
    ghost.style.zIndex = '99999';
    ghost.style.width = `${Math.min(rect.width, 280)}px`;
    ghost.style.boxShadow = '0 12px 28px rgba(0,0,0,0.5)';
    ghost.style.left = `${touch.clientX - 25}px`;
    ghost.style.top = `${touch.clientY - 25}px`;
    ghost.style.transform = 'scale(0.98)';
    ghost.style.transition = 'none';

    document.body.appendChild(ghost);
    this.dragGhost = ghost;
  }

  reset() {
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
    this.dragSource = null;
    this.dragDataTransfer = null;
    this.startTouch = null;
    this.lastTarget = null;
    this.isDragging = false;
  }
}

export const initTouchDragAndDrop = () => {
  if (typeof window !== 'undefined') {
    const manager = new DragDropTouchManager();
    manager.init();
    return manager;
  }
  return null;
};
