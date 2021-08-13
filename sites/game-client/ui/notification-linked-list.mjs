class NotificationLinkedList {
  /**
   *
   */
  constructor() {
    this.length = 0;
    this.head = null;
    this.tail = null;
  }
  // add new node to the tail
  add(notification, timer) {
    this.notificationDom.appendChild(notification);
    const node = new Node(notification, timer);
    if (this.length === 0) {
      this.head = node;
      this.tail = node;
    }
    else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length++;
  }
  // remo
  removeHead(){
    this.notificationDom.removeChild(this.head.notification);
    clearTimeout(this.head.timer);
    this.head = this.head.next;
    this.length--;
  }
  //
  remove(notification){
  // TODO: implement doubly-linked list to reduce the time complexity
    let current = this.head,
        prev = null;
    if ( current.timer === timer ) {
        this.notificationDom.removeChild(current.notification);
        this.head = current.next;
        this.length--;
    }
    else {
      while (current.next != this.tail && current.notification === notification) {
        prev = current;
        current = current.next;
      }
      if (current.next.notification === notification) {
        this.tail = current;
        this.notificationDom.removeChild(notification);
        this.length--;
      }
      else if (current.notification === notification) {
        prev.next = current.next;
        this.notificationDom.removeChild(notification);
        this.length--;
      }
      else {
        console.warn('Cannot delete node of LinkedList since node not found.');
      }
    }
  }
}

class Node {
    constructor(notification, timer) {
        this.item = notification;
        this.timer = timer;
        this.next = null;
    }
}
