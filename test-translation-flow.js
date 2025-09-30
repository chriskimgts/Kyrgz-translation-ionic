const { chromium } = require("playwright");

async function testTranslationFlow() {
  console.log("🚀 Testing Translation Flow in Detail...");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto("http://localhost:4201");
    await page.waitForSelector("h1");

    console.log("✅ App loaded");

    // Enable console logging to see what's happening
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("🔴 Console Error:", msg.text());
      } else if (
        msg.text().includes("translat") ||
        msg.text().includes("error")
      ) {
        console.log("📝 Console:", msg.text());
      }
    });

    // Test simple text translation
    console.log("🔄 Testing simple translation...");

    const userTextInput = await page
      .locator('textarea[placeholder*="Type your message here"]')
      .first();
    await userTextInput.clear();
    await userTextInput.fill("Hello");

    // Look for the translate button and click it
    const translateButtons = await page
      .locator('button:has-text("Translate")')
      .all();
    console.log(`Found ${translateButtons.length} translate buttons`);

    if (translateButtons.length > 0) {
      await translateButtons[0].click();
      console.log("✅ Clicked translate button");

      // Wait longer for the translation process
      await page.waitForTimeout(5000);

      // Check for any spinners or loading states
      const spinners = await page
        .locator('[class*="spinner"], [class*="loading"]')
        .count();
      console.log(`Spinners visible: ${spinners}`);

      // Check if translation appeared anywhere on the page
      const kyrgyzText = await page.locator('text="Салам"').count();
      console.log(`Kyrgyz translation "Салам" found: ${kyrgyzText} times`);

      // Check conversation area
      const conversationArea = await page.locator("#en-conversation");
      const conversationText = await conversationArea.textContent();
      console.log(
        "Conversation area content:",
        conversationText?.substring(0, 100)
      );

      // Check if there are any error messages
      const errorMessages = await page
        .locator('text="error", text="Error", text="failed"')
        .count();
      console.log(`Error messages found: ${errorMessages}`);

      // Take screenshot
      await page.screenshot({
        path: "translation-flow-test.png",
        fullPage: true,
      });
      console.log("📸 Screenshot saved");
    } else {
      console.log("❌ No translate buttons found");
    }

    // Test network requests
    console.log("🌐 Checking network requests...");

    const responses = [];
    page.on("response", (response) => {
      if (response.url().includes("localhost:8788")) {
        responses.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        });
        console.log(
          `📡 API Call: ${response
            .request()
            .method()} ${response.url()} - Status: ${response.status()}`
        );
      }
    });

    // Try another translation to trigger network calls
    await userTextInput.clear();
    await userTextInput.fill("Good morning");
    await translateButtons[0].click();
    await page.waitForTimeout(3000);

    console.log(`📊 Total API calls made: ${responses.length}`);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    await page.screenshot({
      path: "translation-flow-error.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

testTranslationFlow().catch(console.error);
