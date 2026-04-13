/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

let currentProducts = [];
const selectedProducts = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

renderSelectedProducts();

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Check whether a product is currently selected */
function isSelected(productId) {
  return selectedProducts.some((item) => item.id.toString() === productId);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${isSelected(product.id) ? "selected" : ""}" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `,
    )
    .join("");

  const productCards = document.querySelectorAll(".product-card");
  productCards.forEach((card) => {
    card.addEventListener("click", () => {
      const productId = card.dataset.productId;
      toggleProductSelection(productId);
    });
  });
}

/* Toggle selection state for a product */
function toggleProductSelection(productId) {
  const numericId = Number(productId);
  const selectedIndex = selectedProducts.findIndex(
    (product) => product.id === numericId,
  );

  if (selectedIndex >= 0) {
    selectedProducts.splice(selectedIndex, 1);
  } else {
    const product = currentProducts.find((item) => item.id === numericId);
    if (product) {
      selectedProducts.push(product);
    }
  }

  displayProducts(currentProducts);
  renderSelectedProducts();
}

/* Render the list of selected products */
function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="selected-placeholder">
        No products selected yet. Click a product card to add it.
      </div>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product-item">
        <span>${product.name}</span>
        <button class="remove-btn" data-product-id="${product.id}">Remove</button>
      </div>
    `,
    )
    .join("");
}

/* Handle remove button clicks from the selected products list */
selectedProductsList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-btn");
  if (!button) return;

  const productId = button.dataset.productId;
  toggleProductSelection(productId);
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  currentProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(currentProducts);
});

function buildProductsPrompt() {
  if (selectedProducts.length === 0) {
    return "No products are currently selected.";
  }

  return selectedProducts
    .map(
      (product, index) =>
        `${index + 1}. ${product.name} by ${product.brand} - ${product.description}`,
    )
    .join("\n");
}

function appendChatMessage(role, text) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}`;
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function getOpenAIResponse(userText) {
  if (typeof OPENAI_API_KEY === "undefined" || !OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API key is not set. Add OPENAI_API_KEY to secrets.js.",
    );
  }

  const productSummary = buildProductsPrompt();
  const messages = [
    {
      role: "system",
      content:
        "You are a friendly beauty assistant. Use the selected products to answer questions about skincare, haircare, makeup, or routine recommendations.",
    },
    {
      role: "user",
      content: `Selected products:\n${productSummary}\n\nUser question: ${userText}`,
    },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenAI request failed.");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function getRoutineFromOpenAI(selectedProducts) {
  if (selectedProducts.length === 0) {
    throw new Error(
      "Please select at least one product to generate a routine.",
    );
  }

  if (typeof OPENAI_API_KEY === "undefined" || !OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API key is not set. Add OPENAI_API_KEY to secrets.js.",
    );
  }

  const messages = [
    {
      role: "system",
      content:
        "You are an expert beauty routine advisor. Create a step-by-step routine based only on the selected products.",
    },
    {
      role: "user",
      content: `Here are the selected products in JSON format:\n${JSON.stringify(
        selectedProducts,
        null,
        2,
      )}\n\nPlease create a personalized routine using these products, with recommended order, usage tips, and why they work together.`,
    },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
      temperature: 0.75,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenAI request failed.");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

const generateRoutineButton = document.getElementById("generateRoutine");

generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    appendChatMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  appendChatMessage(
    "user",
    `Generate a routine for ${selectedProducts.length} selected product(s).`,
  );
  appendChatMessage("assistant", "Creating a personalized routine...\n");

  try {
    const routine = await getRoutineFromOpenAI(selectedProducts);
    const lastAssistantMessage = chatWindow.querySelector(
      ".chat-message.assistant:last-child",
    );
    if (lastAssistantMessage) {
      lastAssistantMessage.textContent = routine;
    }
  } catch (error) {
    const lastAssistantMessage = chatWindow.querySelector(
      ".chat-message.assistant:last-child",
    );
    if (lastAssistantMessage) {
      lastAssistantMessage.textContent =
        "Sorry, there was a problem generating your routine.";
    }
    console.error(error);
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value.trim();
  if (!userInput) return;

  appendChatMessage("user", `You: ${userInput}`);
  document.getElementById("userInput").value = "";

  appendChatMessage("assistant", "Thinking about your routine...\n");

  try {
    const answer = await getOpenAIResponse(userInput);
    const lastAssistantMessage = chatWindow.querySelector(
      ".chat-message.assistant:last-child",
    );
    if (lastAssistantMessage) {
      lastAssistantMessage.textContent = answer;
    }
  } catch (error) {
    const lastAssistantMessage = chatWindow.querySelector(
      ".chat-message.assistant:last-child",
    );
    if (lastAssistantMessage) {
      lastAssistantMessage.textContent =
        "Sorry, there was a problem connecting to OpenAI.";
    }
    console.error(error);
  }
});
