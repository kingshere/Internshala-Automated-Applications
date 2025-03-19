const pup = require("puppeteer");
let { id, pass } = require("./secret");
let tab;
let dataFile = require("./data");

async function main() {

    let browser = await pup.launch({
        headless: false,
        defaultViewport: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        args: ["--start-maximized"]
    });

    let pages = await browser.pages();
    tab = pages[0];
    await tab.goto("https://internshala.com/");
    
    // Wait for the login button and click it
    await tab.waitForSelector("button.login-cta", { visible: true, timeout: 60000 });
    await tab.click("button.login-cta");
    
    // Fill in login details
    await tab.type("#modal_email", id);
    await tab.type("#modal_password", pass);
    await tab.click("#modal_login_submit");
    await tab.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
    
    // Add a longer wait time to ensure the page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log("Logged in successfully, navigating to profile...");
    
    // Navigate directly to the resume page instead of using dropdown
    await tab.goto("https://internshala.com/student/resume");
    
    // Wait longer for the page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log("On resume page, looking for education section...");
    
    try {
        // Check if we need to add education or if it already exists
        const educationSections = await tab.$$('.education_details');
        
        if (educationSections.length > 0) {
            console.log("Education section already exists, checking if we need to edit...");
            
            // Look for edit buttons
            const editButtons = await tab.$$('.edit-btn');
            if (editButtons.length > 0) {
                console.log("Found edit button, clicking...");
                await editButtons[0].click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } else {
            console.log("Looking for add education button...");
            
            // Try to find the add education button by text content
            const addButtons = await tab.$$('a.add_new_btn');
            let educationButtonFound = false;
            
            for (const button of addButtons) {
                const text = await tab.evaluate(el => el.textContent.trim(), button);
                console.log("Found button:", text);
                
                if (text.includes("Add education")) {
                    console.log("Clicking 'Add education' button...");
                    await button.click();
                    educationButtonFound = true;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    break;
                }
            }
            
            if (!educationButtonFound) {
                console.log("Could not find add education button, trying alternative selectors...");
                
                // Try by CSS selector that might contain the add education button
                const possibleButtons = await tab.$$('.add-section-btn, .add-btn, .btn-add');
                for (const button of possibleButtons) {
                    const text = await tab.evaluate(el => el.textContent.trim(), button);
                    console.log("Possible add button:", text);
                    
                    if (text.includes("Add") && (text.includes("education") || text.includes("degree"))) {
                        console.log("Found education add button, clicking...");
                        await button.click();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        break;
                    }
                }
            }
        }
        
        // Now try to fill in education details
        await graduation(dataFile[0]);
        
        // Continue with the rest of the flow with increased timeouts
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Look for next button with more flexible selector
        const nextButtons = await tab.$$('button.next-button, .btn-next, .next-btn');
        if (nextButtons.length > 0) {
            console.log("Found next button, clicking...");
            await nextButtons[0].click();
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            console.log("Could not find next button, trying to continue anyway...");
        }

        // Continue with training section
        await training(dataFile[0]);
        
        // Rest of the flow continues...
        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });

        await tab.waitForSelector(".next-button", { visible: true });
        await tab.click(".next-button");

        await training(dataFile[0]);

        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });

        await tab.waitForSelector(".next-button", { visible: true });
        await tab.click(".next-button");

        await tab.waitForSelector(".btn.btn-secondary.skip.skip-button", { visible: true });
        await tab.click(".btn.btn-secondary.skip.skip-button");

        await workSample(dataFile[0]);

        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });

        await tab.waitForSelector("#save_work_samples", { visible: true });
        await tab.click("#save_work_samples");

        // await tab.waitForSelector(".resume_download_mobile", {visible : true});
        // await tab.click(".resume_download_mobile");                                // if you want to download resume.

        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });
        await application(dataFile[0]);
    } catch (error) {
        console.log("Error in main flow:", error.message);
        console.log("Taking a screenshot to debug...");
        await tab.screenshot({ path: 'error-screenshot.png' });
        
        console.log("Current page URL:", await tab.url());
        console.log("Trying to continue with application section directly...");
        
        try {
            await application(dataFile[0]);
        } catch (appError) {
            console.log("Error in application section:", appError.message);
        }
    }
}

// Modify the graduation function to be more resilient
async function graduation(data) {
    try {
        console.log("Attempting to fill graduation details...");
        
        // Wait for form elements with increased timeout and try different selectors
        const degreeStatusSelector = "#degree_completion_status_pursuing, input[name='degree_status'][value='pursuing']";
        await tab.waitForSelector(degreeStatusSelector, { visible: true, timeout: 30000 });
        await tab.click(degreeStatusSelector);
        
        const collegeSelector = "#college, input[name='college']";
        await tab.waitForSelector(collegeSelector, { visible: true, timeout: 30000 });
        await tab.type(collegeSelector, data["College"]);
        
        // Handle year selection more flexibly
        try {
            await tab.waitForSelector("#start_year_chosen", { visible: true, timeout: 10000 });
            await tab.click("#start_year_chosen");
            await tab.waitForSelector(".active-result", { visible: true, timeout: 10000 });
            
            // Get all year options and select one that makes sense (e.g., 2020)
            const yearOptions = await tab.$$(".active-result");
            for (const option of yearOptions) {
                const yearText = await tab.evaluate(el => el.textContent.trim(), option);
                if (yearText === "2020") {
                    await option.click();
                    break;
                }
            }
        } catch (yearError) {
            console.log("Error selecting start year:", yearError.message);
            // Try alternative year selector if available
        }
        
        // Similar approach for end year
        await tab.waitForSelector("#end_year_chosen", { visible: true });
        await tab.click('#end_year_chosen');
        await tab.waitForSelector("#end_year_chosen .active-result[data-option-array-index = '6']", { visible: true });
        await tab.click("#end_year_chosen .active-result[data-option-array-index = '6']");

        await tab.waitForSelector("#degree", { visible: true });
        await tab.type("#degree", data["Degree"]);

        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });
        await tab.waitForSelector("#stream", { visible: true });
        await tab.type("#stream", data["Stream"]);

        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });
        await tab.waitForSelector("#performance-college", { visible: true });
        await tab.type("#performance-college", data["Percentage"]);

        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });

        await tab.click("#college-submit");
    } catch (error) {
        console.log("Error in graduation function:", error.message);
        console.log("Taking a screenshot of graduation form...");
        await tab.screenshot({ path: 'graduation-form-error.png' });
    }
}

async function training(data) {
    await tab.waitForSelector(".experiences-tabs[data-target='#training-modal'] .ic-16-plus", { visible: true });
    await tab.click(".experiences-tabs[data-target='#training-modal'] .ic-16-plus");

    await tab.waitForSelector("#other_experiences_course", { visible: true });
    await tab.type("#other_experiences_course", data["Training"]);

    await new Promise(function (resolve, reject) {
        return setTimeout(resolve, 1000);
    });

    await tab.waitForSelector("#other_experiences_organization", { visible: true });
    await tab.type("#other_experiences_organization", data["Organization"]);

    await new Promise(function (resolve, reject) {
        return setTimeout(resolve, 1000);
    });

    await tab.click("#other_experiences_location_type_label");

    await tab.click("#other_experiences_start_date");

    await new Promise(function (resolve, reject) {
        return setTimeout(resolve, 1000);
    });

    await tab.waitForSelector(".ui-state-default[href='#']", { visible: true });
    let date = await tab.$$(".ui-state-default[href='#']");
    await date[0].click();
    await tab.click("#other_experiences_is_on_going");

    await tab.waitForSelector("#other_experiences_training_description", { visible: true });
    await tab.type("#other_experiences_training_description", data["description"]);

    await new Promise(function (resolve, reject) {
        return setTimeout(resolve, 2000);
    });

    await tab.click("#training-submit");

}

async function workSample(data) {
    await tab.waitForSelector("#other_portfolio_link", { visible: true });
    await tab.type("#other_portfolio_link", data["link"]);
}

async function application(data) {

    await tab.goto("https://internshala.com/the-grand-summer-internship-fair");

    await tab.waitForSelector(".btn.btn-primary.campaign-btn.view_internship", { visible: true });
    await tab.click(".btn.btn-primary.campaign-btn.view_internship")

    await new Promise(function (resolve, reject) {
        return setTimeout(resolve, 2000);
    });
    await tab.waitForSelector(".view_detail_button", { visible: true });
    let details = await tab.$$(".view_detail_button");
    let detailUrl = [];
    for (let i = 0; i < 3; i++) {
        let url = await tab.evaluate(function (ele) {
            return ele.getAttribute("href");
        }, details[i]);
        detailUrl.push(url);
    }

    for (let i of detailUrl) {
        await apply(i, data);
        await new Promise(function (resolve, reject) {
            return setTimeout(resolve, 1000);
        });
    }

}

async function apply(url, data) {
    await tab.goto("https://internshala.com" + url);

    await tab.waitForSelector(".btn.btn-large", { visible: true });
    await tab.click(".btn.btn-large");

    await tab.waitForSelector("#application_button", { visible: true });
    await tab.click("#application_button");

    await tab.waitForSelector(".textarea.form-control", { visible: true });
    let ans = await tab.$$(".textarea.form-control");

    for (let i = 0; i < ans.length; i++) {
        if (i == 0) {
            await ans[i].type(data["hiringReason"]);
            await new Promise(function (resolve, reject) {
                return setTimeout(resolve, 1000);
            });
        }
        else if (i == 1) {
            await ans[i].type(data["availability"]);
            await new Promise(function (resolve, reject) {
                return setTimeout(resolve, 1000);
            });
        }
        else {
            await ans[i].type(data["rating"]);
            await new Promise(function (resolve, reject) {
                return setTimeout(resolve, 1000);
            });
        }
    }

    await tab.click(".submit_button_container");

}

main();