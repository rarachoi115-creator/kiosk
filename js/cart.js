/**
 * 장바구니 상태를 관리하고 sessionStorage에 저장하는 모듈입니다.
 * 새로고침하거나 다른 화면을 다녀와도 장바구니 내역이 유지됩니다.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "mongle_mart_cart_items";

  /**
   * sessionStorage에서 저장된 장바구니 목록을 안전하게 읽어 옵니다.
   * @returns {Array<{ className: string, name: string, price: number, quantity: number, color?: string }>}
   */
  function loadItemsFromStorage() {
    if (!global.sessionStorage) {
      return [];
    }

    try {
      const raw = global.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      // 필수 값이 올바른 항목만 복원
      return parsed
        .filter(function (item) {
          return (
            item &&
            typeof item.className === "string" &&
            typeof item.name === "string" &&
            typeof item.price === "number" &&
            typeof item.quantity === "number" &&
            item.quantity > 0
          );
        })
        .map(function (item) {
          return {
            className: item.className,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            color: typeof item.color === "string" ? item.color : "#64748b"
          };
        });
    } catch (err) {
      console.warn("장바구니 불러오기 실패:", err);
      return [];
    }
  }

  /**
   * 현재 장바구니 목록을 sessionStorage에 저장합니다.
   * @param {Array} items
   */
  function saveItemsToStorage(items) {
    if (!global.sessionStorage) {
      return;
    }

    try {
      global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn("장바구니 저장 실패:", err);
    }
  }

  /**
   * 장바구니 인스턴스를 생성합니다.
   */
  function createCart() {
    let items = loadItemsFromStorage();

    /**
     * 현재 장바구니 목록 복사본을 돌려줍니다.
     */
    function getItems() {
      return items.map(function (item) {
        return Object.assign({}, item);
      });
    }

    /**
     * 장바구니 요약 정보(목록, 총 수량, 합계 금액)를 계산해 돌려줍니다.
     */
    function getSummary() {
      let totalCount = 0;
      let totalPrice = 0;

      items.forEach(function (item) {
        totalCount += item.quantity;
        totalPrice += item.price * item.quantity;
      });

      return {
        items: getItems(),
        totalCount: totalCount,
        totalPrice: totalPrice
      };
    }

    /**
     * 상품을 장바구니에 1개 담습니다.
     * 같은 클래스 이름의 상품이 이미 있으면 새 줄을 만들지 않고 수량만 1 올립니다.
     *
     * @param {{ className: string, name: string, price: number, color?: string }} product
     * @returns {{ items: Array, totalCount: number, totalPrice: number, addedClassName: string | null }}
     */
    function addItem(product) {
      if (!product || typeof product.className !== "string") {
        return Object.assign(getSummary(), { addedClassName: null });
      }

      const existing = items.find(function (item) {
        return item.className === product.className;
      });

      if (existing) {
        existing.quantity += 1;
      } else {
        items.push({
          className: product.className,
          name: product.name || product.className,
          price: Number(product.price) || 0,
          quantity: 1,
          color: typeof product.color === "string" ? product.color : "#64748b"
        });
      }

      saveItemsToStorage(items);
      return Object.assign(getSummary(), { addedClassName: product.className });
    }

    /**
     * 장바구니를 비우고 sessionStorage에서도 지웁니다.
     */
    function clear() {
      items = [];
      saveItemsToStorage(items);
      return getSummary();
    }

    return {
      getItems: getItems,
      getSummary: getSummary,
      addItem: addItem,
      clear: clear
    };
  }

  // 브라우저(window)와 Node.js(globalThis) 양쪽에서 쓸 수 있도록 등록
  global.createCart = createCart;
})(typeof window !== "undefined" ? window : globalThis);
