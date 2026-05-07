// API Configuration
const API_URL = "/api";

// Password helper – asks once and caches
let cachedPassword = null;
async function getWritePassword() {
  if (cachedPassword) return cachedPassword;
  const pwd = prompt("🔐 Enter password to add / delete trades:");
  if (pwd) cachedPassword = pwd;
  return pwd;
}

// Global state
let trades = [];

// DOM Elements
let orderIdInput, tradeDateInput, quantityInput, buyRateInput, sellRateInput;
let addTradeBtn, refreshBtn, resetBtn;
let totalTradesSpan, totalProfitSpan, totalReinvestSpan, btdSpan, srtSpan;
let tradesTableBody, lastUpdateSpan, connectionStatus;
let totalVolumeTradedSpan;

// Helper Functions
function getCurrentDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  return `${dd} . ${mm} . ${yyyy}`;
}

// Calculate profit using correct formula:
// 1. Amount = Quantity × Buy Rate
// 2. Y Amount = Amount × Sell Rate
// 3. Profit = Y Amount - Quantity
function calculateProfit(quantity, buyRate, sellRate) {
  const amount = quantity / buyRate;
  const yAmount = amount * sellRate;
  const profit = yAmount - quantity;
  return profit;
}

// Get next order ID
function getNextOrderId() {
  if (trades.length === 0) return 1;
  const maxId = Math.max(...trades.map((t) => t.orderId));
  return maxId + 1;
}

// API Calls
async function fetchTrades() {
  try {
    console.log("🔄 Fetching trades from server...");
    const response = await fetch(`${API_URL}/trades`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    trades = await response.json();
    console.log(`✅ Loaded ${trades.length} trades from server`);
    updateConnectionStatus(true);
    renderAll();
    return trades;
  } catch (error) {
    console.error("❌ Error fetching trades:", error);
    updateConnectionStatus(false);
    tradesTableBody.innerHTML = `<tr class="empty-row"><td colspan="9">❌.<br><br>Make sure server is running:<br></td></tr>`;
    return [];
  }
}

async function addTradeToServer(trade) {
  try {

    const password = await getWritePassword();
    if (!password) return null;

    const response = await fetch(`${API_URL}/trades`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Password": password,     
      },
      body: JSON.stringify(trade),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Trade saved successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Error adding trade:", error);
    alert(
      `❌ Failed to save to trades.json\n\nError: ${error.message}\n\nMake sure server is running on port 3000`,
    );
    return null;
  }
}

async function deleteTradeFromServer(orderId) {
  try {

    const password = await getWritePassword();
    if (!password) return false;

    const response = await fetch(`${API_URL}/trades/${orderId}`, {
      method: "DELETE",
      headers: { "X-Password": password },
    });
    if (!response.ok) throw new Error("Failed to delete");
    return true;
  } catch (error) {
    console.error("Error deleting trade:", error);
    alert("❌ Failed to delete from trades.json");
    return false;
  }
}

async function resetAllTrades() {
  if (
    !confirm(
      "⚠️ WARNING: This will permanently delete ALL trades from trades.json!\n\nAre you absolutely sure?",
    )
  )
    return;

  try {

    const password = await getWritePassword();
if (!password) return;

    const response = await fetch(`${API_URL}/trades`, {
      method: "DELETE",
      headers: { "X-Password": password }
    });
    if (!response.ok) throw new Error("Failed to reset");
    await fetchTrades();
    alert("✅ All trades cleared from trades.json");
  } catch (error) {
    console.error("Error resetting:", error);
    alert("❌ Failed to reset trades.json");
  }
}

// UI Rendering
// UI Rendering - Custom Card UI with Tailwind Only
function renderTradesTable() {
  if (!tradesTableBody) return;

  // Get the parent container where the table is
  const tableContainer = document.getElementById("tradesTable")?.parentElement;
  if (!tableContainer) return;

  // Hide the original table
  const originalTable = document.getElementById("tradesTable");
  if (originalTable) originalTable.classList.add("hidden");

  // Create or get the custom cards container
  let cardsContainer = document.getElementById("customTradesContainer");
  if (!cardsContainer) {
    cardsContainer = document.createElement("div");
    cardsContainer.id = "customTradesContainer";
    cardsContainer.className = "space-y-3 p-3";
    tableContainer.appendChild(cardsContainer);
  }

  if (trades.length === 0) {
    cardsContainer.innerHTML = `
            <div class="text-center py-12 px-4 bg-white rounded-xl shadow-sm border border-gray-200">
                <h3 class="text-xl font-semibold text-gray-700 mb-2">No Trades Yet</h3>
                <p class="text-gray-500">Create your first order to see it here!</p>
            </div>
        `;
    return;
  }

  let html = "";
  trades.forEach((trade) => {
    const amount = trade.quantity * trade.buyRate;
    const profitClass =
      trade.profit >= 0
        ? "bg-green-50 border-green-200 text-green-800"
        : "bg-red-50 border-red-200 text-red-800";
    const profitBg =
      trade.profit >= 0
        ? "bg-gradient-to-br from-black/50 to-black/80"
        : "bg-gradient-to-br from-red-400 to-red-600";
    const profitEmoji = trade.profit >= 0 ? "Profit" : "Loss";

    html += `
            <div class="bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden transform hover:-translate-y-1">
                <!-- Card Header -->
                <div class="${profitBg} px-4 py-3 flex justify-between items-center">
                    <div class="flex items-center">
                        <span class="text-white text-sm">#</span>
                        <span class="text-white font-bold text-lg">${trade.orderId}</span>
                    </div>
                    <span class="text-white text-lg font-normal italic">${trade.date}</span>
                </div>
                
                <!-- Card Body -->
                <div class="p-2">
                    <!-- Trade Details Grid -->
                    <span class="text-xs italic text-black">Quantity / Buy Price = Tokens</span>
                    <div class="grid grid-cols-[39%_20%_39%] gap-1 mt-1 mb-2 bg-gray-200 rounded-lg p-1">
                        <div class="bg-gray-100 rounded-lg p-3 text-center">
                            <div class="text-xs text-gray-500 mb-1">Quantity</div>
                            <div class="font-bold text-gray-800">${trade.quantity.toLocaleString()}</div>
                        </div>
                        <div class="bg-gray-100 rounded-lg p-3 text-center">
                            <div class="text-xs text-black mb-1">Buy</div>
                            <div class="font-bold text-black">₹${trade.buyRate.toFixed(2)}</div>
                        </div>
                        <div class="bg-blue-50 rounded-lg p-3 text-center">
                            <div class="text-xs text-black mb-1">Tokens</div>
                            <div class="font-bold text-black">${(trade.usdtQuantity != null ? trade.usdtQuantity : trade.quantity / trade.buyRate).toFixed(0)}</div>
                        </div>
                    </div>

                    <span class="text-xs italic text-black">Tokens x Sell Price = Gross</span>
                    <div class="grid grid-cols-[39%_20%_39%] gap-1 mt-1 mb-2 bg-gray-200 rounded-lg p-1">
                        <div class="bg-gray-100 rounded-lg p-3 text-center">
                            <div class="text-xs text-gray-500 mb-1">Tokens</div>
                            <div class="font-bold text-gray-800">${(trade.usdtQuantity != null ? trade.usdtQuantity : trade.quantity / trade.buyRate).toFixed(0)}</div>
                        </div>
                        <div class="bg-gray-100 rounded-lg p-3 text-center">
                            <div class="text-xs text-black mb-1">Sell</div>
                            <div class="font-bold text-black">₹${trade.sellRate.toFixed(2)}</div>
                        </div>
                        <div class="bg-pink-100 rounded-lg p-3 text-center">
                            <div class="text-xs text-black mb-1">Gross</div>
                            <div class="font-bold text-black">₹${(trade.grossQuantity != null ? trade.grossQuantity : (trade.usdtQuantity ?? trade.quantity / trade.buyRate) * trade.sellRate).toFixed(0)}</div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-[80%_20%] flex items-stretch justify-between gap-1">
                    <!-- Profit Display -->
                    <div class="text-white bg-[#26a17b] border rounded-t-md rounded-bl-2xl rounded-br-md p-3 flex items-center justify-between">
                    <span class="font-bold text-lg w-full text-center">
                    ${trade.profit >= 0 ? "+ " : ""}₹${trade.profit.toFixed(0)}
                    </span>
                    </div>
                    
                    <!-- Action Button -->
                    <button 
                    class="delete-custom-btn w-full bg-[#ff0000]/50 hover:bg-[#ff0000]/90 hover:text-white text-black font-medium rounded-t-md rounded-bl-md rounded-br-2xl transition-colors duration-200 border border-red-200 hover:border-red-300 flex items-center justify-center space-x-2"
                    data-id="${trade.orderId}"
                    >
                        <span>x</span>
                        </button>
                    </div>
                                    </div>
            </div>
        `;
  });

  cardsContainer.innerHTML = html;

  // Attach delete events
  document.querySelectorAll(".delete-custom-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const orderId = parseInt(btn.dataset.id);
      if (
        confirm(
          `⚠️ Are you sure you want to delete order #${orderId}?\n\nThis action cannot be undone.`,
        )
      ) {
        // Add loading state
        btn.disabled = true;
        btn.innerHTML = `
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    <span>Deleting...</span>
                `;

        const success = await deleteTradeFromServer(orderId);
        if (success) {
          await fetchTrades();
        } else {
          btn.disabled = false;
          btn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Order</span>
                    `;
          alert("❌ Failed to delete order. Please try again.");
        }
      }
    });
  });
}

function updateStatsAndSummaries() {
  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const totalTrades = trades.length;
  const totalVolume = trades.reduce((sum, t) => sum + t.quantity, 0); // 👈 new
  const btdShare = totalProfit / 2;
  const srtShare = totalProfit / 2;

  if (totalTradesSpan) totalTradesSpan.textContent = totalTrades;
  if (totalProfitSpan)
    totalProfitSpan.textContent = `${totalProfit.toFixed(0)}`;
  if (totalReinvestSpan)
    totalReinvestSpan.textContent = `₹${totalProfit.toFixed(0)}`;
  if (totalVolumeTradedSpan)
    totalVolumeTradedSpan.textContent = `₹${totalVolume.toFixed(0)}`; // 👈 new
  if (btdSpan) btdSpan.textContent = `₹${btdShare.toFixed(0)}`;
  if (srtSpan) srtSpan.textContent = `₹${srtShare.toFixed(0)}`;
}

function updateOrderIdPreview() {
  if (orderIdInput) {
    const nextId = getNextOrderId();
    orderIdInput.value = `#${nextId}`;
  }
}

function updateTimestamp() {
  if (lastUpdateSpan) {
    const now = new Date();
    lastUpdateSpan.textContent = `Last Sync : ${now.toLocaleTimeString()}`;
  }
}

function updateConnectionStatus(connected) {
  if (connectionStatus) {
    if (connected) {
      connectionStatus.innerHTML =
        '<span class="w-3 h-3 rounded-full bg-[#22c55e]"></span> <span class="text-sm font-normal tracking-wide">L I V E</span> ';
      connectionStatus.style.background = "#d4f0de";
      connectionStatus.style.border = "1px solid #becec3";
    } else {
      connectionStatus.innerHTML =
        '<span class="w-3 h-3 rounded-full bg-[#ef4444]"></span> <span class="text-sm font-normal tracking-wide">O F F L I N E</span>';
      connectionStatus.style.background = "#fef2f2";
      connectionStatus.style.border = "1px solid #fecaca";
    }
  }
}

function renderAll() {
  renderTradesTable();
  updateStatsAndSummaries();
  updateOrderIdPreview();
  updateTimestamp();
}

// Form Submission
async function handleAddTrade() {
  const quantity = parseFloat(quantityInput.value);
  const buyRate = parseFloat(buyRateInput.value);
  const sellRate = parseFloat(sellRateInput.value);

  if (isNaN(quantity) || quantity <= 0) {
    alert("❌ Please enter a valid Quantity (positive number)");
    quantityInput.focus();
    return;
  }
  if (isNaN(buyRate) || buyRate <= 0) {
    alert("❌ Please enter a valid Buy Rate");
    buyRateInput.focus();
    return;
  }
  if (isNaN(sellRate) || sellRate <= 0) {
    alert("❌ Please enter a valid Sell Rate");
    sellRateInput.focus();
    return;
  }

  // const profit = calculateProfit(quantity, buyRate, sellRate);

  // Calculate the new fields (client can pre‑calculate, but server will overwrite)
  const usdtQuantity = quantity / buyRate;
  const grossQuantity = usdtQuantity * sellRate;
  const profit = grossQuantity - quantity; // use the correct formula

  const newTrade = {
    orderId: getNextOrderId(),
    date: getCurrentDate(),
    quantity: quantity,
    buyRate: buyRate,
    sellRate: sellRate,
    usdtQuantity: usdtQuantity, // ✅ add
    grossQuantity: grossQuantity, // ✅ add
    profit: profit,
  };

  const result = await addTradeToServer(newTrade);
  if (result && result.success) {
    await fetchTrades();
    clearForm();

    const amount = quantity * buyRate;
    const yAmount = amount * sellRate;
    alert(`success !`);
  }
}

function clearForm() {
  quantityInput.value = "";
  buyRateInput.value = "";
  sellRateInput.value = "";
  quantityInput.focus();
}

// Test server connection
async function testConnection() {
  try {
    const response = await fetch(`${API_URL}/trades`);
    if (response.ok) {
      console.log("✅ Server connection successful");
      updateConnectionStatus(true);
      return true;
    }
  } catch (error) {
    console.error("❌ Server connection failed:", error);
    updateConnectionStatus(false);
    return false;
  }
}

// Initialization
async function init() {
  console.log("🚀 Initializing Trading Partner Ledger...");

  // Get DOM elements
  orderIdInput = document.getElementById("orderId");
  tradeDateInput = document.getElementById("tradeDate");
  quantityInput = document.getElementById("quantity");
  buyRateInput = document.getElementById("buyRate");
  sellRateInput = document.getElementById("sellRate");
  addTradeBtn = document.getElementById("addTradeBtn");
  refreshBtn = document.getElementById("refreshBtn");
  resetBtn = document.getElementById("resetBtn");
  totalTradesSpan = document.getElementById("totalTradesCount");
  totalProfitSpan = document.getElementById("totalProfitSum");
  totalReinvestSpan = document.getElementById("totalReinvestedCapital");
  btdSpan = document.getElementById("btdShare");
  srtSpan = document.getElementById("srtShare");
  tradesTableBody = document.getElementById("tradesTableBody");
  lastUpdateSpan = document.getElementById("lastUpdateTime");
  connectionStatus = document.querySelector(".status-badge");
  totalVolumeTradedSpan = document.getElementById("totalVolumeTraded");

  // Set date
  if (tradeDateInput) tradeDateInput.value = getCurrentDate();

  // Test connection and load data
  await testConnection();
  await fetchTrades();

  // Event listeners
  if (addTradeBtn) addTradeBtn.addEventListener("click", handleAddTrade);
  if (refreshBtn) refreshBtn.addEventListener("click", fetchTrades);
  if (resetBtn) resetBtn.addEventListener("click", resetAllTrades);

  // Enter key support
  [quantityInput, buyRateInput, sellRateInput].forEach((input) => {
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddTrade();
        }
      });
    }
  });

  console.log("✅ Application ready");
}

// Start app
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
