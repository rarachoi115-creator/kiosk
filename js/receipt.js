/**
 * 완료 화면(receipt.html)에서 장바구니를 비우고 저장된 영수증을 표시하며
 * 새 주문 시작 처리를 담당합니다.
 */
(function () {
  "use strict";

  const receiptEmptyView = document.getElementById("receipt-empty-view");
  const receiptMainView = document.getElementById("receipt-main-view");
  const receiptOrderNumber = document.getElementById("receipt-order-number");
  const receiptPaidAt = document.getElementById("receipt-paid-at");
  const receiptPaymentMethod = document.getElementById("receipt-payment-method");
  const receiptItemsList = document.getElementById("receipt-items-list");
  const receiptTotalPrice = document.getElementById("receipt-total-price");
  const newOrderButton = document.getElementById("new-order-button");

  const cart = window.createCart();
  const receipt = window.loadReceipt();

  /**
   * 저장된 영수증을 화면에 그립니다.
   */
  function renderReceipt() {
    if (!receipt) {
      receiptEmptyView.hidden = false;
      receiptMainView.hidden = true;
      return;
    }

    // 완료 화면에 들어오면 장바구니는 비우고 영수증만 유지(새로고침 시에도 동일하게 표시)
    cart.clear();

    receiptEmptyView.hidden = true;
    receiptMainView.hidden = false;

    receiptOrderNumber.textContent = receipt.orderNumber;
    receiptPaidAt.textContent = receipt.paidAt;
    receiptPaymentMethod.textContent = receipt.paymentMethod;
    receiptTotalPrice.textContent = window.formatPrice(receipt.totalPrice);

    receiptItemsList.innerHTML = "";
    receipt.items.forEach(function (item) {
      const row = document.createElement("li");
      row.className = "order-summary-row";

      const nameWrap = document.createElement("div");
      nameWrap.className = "order-item-name-wrap";

      const nameSpan = document.createElement("span");
      nameSpan.className = "order-item-name";
      nameSpan.textContent = item.name;
      nameWrap.appendChild(nameSpan);

      const qtySpan = document.createElement("span");
      qtySpan.className = "order-item-qty";
      qtySpan.textContent = item.quantity + "개";

      const amountSpan = document.createElement("span");
      amountSpan.className = "order-item-amount";
      amountSpan.textContent = window.formatPrice(item.price * item.quantity);

      row.appendChild(nameWrap);
      row.appendChild(qtySpan);
      row.appendChild(amountSpan);
      receiptItemsList.appendChild(row);
    });
  }

  // "새 주문 시작": 저장된 영수증을 지우고 시작 화면(index.html)으로 이동
  newOrderButton.addEventListener("click", function () {
    window.clearReceipt();
    cart.clear();
    window.location.href = "index.html";
  });

  renderReceipt();
})();
