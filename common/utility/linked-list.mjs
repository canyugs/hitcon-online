// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Nodes in the linkedlist.
*/
class Node {
  /**
   * @param {any} content
   * @param {Node} next - The memory which the Node points to.
   */
  constructor(content, next) {
    this.content = content;
    this.next = next ?? null;
  }

  /**
   * @return {Boolen} Check type of Node
   */
  isPointer() {
    return this.content === null;
  }
}

/**
 * A simple implementation of singly-linked list.
 */
class LinkedList {
  /**
   * An empty list looks like : head -> tail
   * A non-empty list looks like : head -> A -> B -> tail
   */
  constructor() {
    this.length = 0;
    this.tail = new Node(null, null);
    this.head = new Node(null, this.tail);
  }
  /**
   * @return {Boolean} whether the list is empty
   */
  empty() {
    return this.length === 0;
  }

  /**
   * Insert a node in the begin of the list
   * @param {any} content
   * @return {Node} newNode - A newNode be inserted
   */
  insert(content) {
    this.length += 1;
    const newNode = new(content, this.head.next);
    this.head.next = newNode;
    return newNode;
  }

  /**
   * Delete a node
   * @param {Node} node - A node need to be removed
   * @return {Boolean} Whether the node be deleted
   */
  delete(node) {
    // head and tail cannot be deleted
    if (node.isPointer()) {
      console.warn('Cannot delete head or tail.');
      return false;
    }

    let iter = this.head;
    while (iter.next !== node) {
      if (iter.next === null) {
        console.warn('Cannot delete node of LinkedList since node not found.');
        return false;
      }
      iter = iter.next;
    }

    // right now, `iter.next` points to `node`
    this.length -= 1;
    iter.next = node.next;
    return true;
  }
}

export default LinkedList;
