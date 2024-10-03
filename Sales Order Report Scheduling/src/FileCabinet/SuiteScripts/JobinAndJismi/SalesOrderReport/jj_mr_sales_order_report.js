/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/email', 'N/format', 'N/log', 'N/record', 'N/search'],
    /**
 * @param{email} email
 * @param{format} format
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */
    (email, format, log, record, search) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {

            try {
                return createSalesOrderSearch();
            } catch (e) {
                logError('getInputData Error', e);
            }
        }

        /**
         * Creates a search for today's sales orders.
         * @function createSalesOrderSearch
         * @returns {Object} A search object configured to find today's sales orders.
         * @throws {Error} Throws an error if search creation fails.
         */
        const createSalesOrderSearch = () => {
            try {
                const searchResult = search.create({
                    type: "salesorder",
                    filters: [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["trandate", "within", "today"],
                        "AND",
                        ["mainline", "is", "T"]
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'entity' }),
                        search.createColumn({ name: "tranid" }),
                        search.createColumn({ name: "salesrep" }),
                        search.createColumn({ name: "trandate" }),
                        search.createColumn({ name: "amount" }),
                        search.createColumn({
                            name: "supervisor",
                            join: "salesRep"
                        })
                    ]
                }).run();

                const results = searchResult.getRange({ start: 0, end: 1000 });

                if (results.length === 0) {
                    log.debug("No Sales Orders", "No sales orders created today.");
                    return []; // Return an empty array if no results found
                }

                return results;

            } catch (e) {
                logError('createSalesOrderSearch Error', e);
                throw e;
            }
        }


        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {

            try {
                let searchResult = JSON.parse(mapContext.value);
                // log.debug("Search Result", searchResult);
                let salesDetails = fetchSalesDetails(searchResult);
                //log.debug("Sales Details", salesDetails);
                mapContext.write({
                    key: salesDetails.salesRepId,
                    value: salesDetails

                });
            } catch (e) {
                logError('map Error', e);
            }

        }

        const fetchSalesDetails = (searchResult) => {
            let salesRepId = searchResult.values.salesrep[0].value;
            // log.debug("Sales Rep Id", salesRepId);

            return {
                documentNumber: searchResult.values.tranid,
                customerName: searchResult.values.entity[0].text,
                date: searchResult.values.trandate,
                salesAmount: searchResult.values.amount,
                supervisor: searchResult.values['salesRep.supervisor'][0].value,
                salesRepName: searchResult.values.salesrep[0].text,
                internalId: searchResult.values.internalid[0].value,
                salesRepId: salesRepId
            }

        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {

            try {
                const salesRepId = reduceContext.key;
                const salesOrderDetails = reduceContext.values.map(JSON.parse);

                if (salesOrderDetails.length > 0) {
                    const supervisorId = salesOrderDetails[0].supervisor ||-5;
                    const salesRepName = salesOrderDetails[0].salesRepName;
                    const body = createEmailBody(salesOrderDetails);

                    let today = new Date();
                    let todayDate = format.format({
                        type: format.Type.DATE,
                        value: today
                    });
                    let subject = `${salesRepName}, Kindly review your sales order ${todayDate}`;

                    // Send the email
                    sendEmail(supervisorId, salesRepId, subject, body);
                }
            } catch (e) {
                log.error({
                    title: 'Error Processing Request',
                    details: e.message,
                });
            }
        }


        /**
         * Creates the email body containing a summary table of sales order details.
         * @param {Array<Object>} salesOrderDetails - An array of sales order objects.
         * @returns {string} The HTML body of the email with a table of sales orders.
         */
        const createEmailBody = (salesOrderDetails) => {

            log.debug("Sales Order details", salesOrderDetails);
            let body = '<table><tr><td> Dear,</td></tr><tr><td>' +
                'We hope this message finds you well. We would like to provide you with a summary of sales orders processed today.' +
                ' Please review the attached detailed report for more information.</td></tr>' +
                '<tr><td><table border="1"><tr><th><b>Document Number</b></th><th><b>Customer Name</b></th>' +
                '<th><b>Date of Sales Order Creation</b></th><th><b>Total Amount</b></th></tr>';

            for (let j = 0; j < salesOrderDetails.length; j++) {
                const orderDetails = salesOrderDetails[j];
                let customer = orderDetails.customerName;
                let date = orderDetails.date;
                let tranid = orderDetails.documentNumber;
                let amount = orderDetails.salesAmount;
                let internalId = orderDetails.internalId;
                let link = `https://tstdrv2949605.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${internalId}&whence=`;

                body += `<tr><td><a href="${link}">${tranid}</a></td><td>${customer}</td><td>${date}</td><td>${amount}</td></tr>`;
            }

            body += '</table></td></tr>' +
                '<tr><td>With regards,</td></tr><tr><td></td></tr>';

            log.debug("Body", body);

            return body;
        };
        /**
 * Sends an email to the specified recipient.
 * 
 * @function sendEmail
 * @param {string} supervisorId - The internal ID of the supervisor who is the author of the email.
 * @param {string} salesRepId - The internal ID of the sales rep who is the recipient of the email.
 * @param {string} subject - The subject line of the email.
 * @param {string} body - The HTML body content of the email.
 * @throws {Error} Throws an error if the email fails to send.
 */

        const sendEmail = (supervisorId, salesRepId, subject, body) => {
            try {
                email.send({
                    author: supervisorId, 
                    recipients: salesRepId, 
                    subject: subject,
                    body: body,
                    //isHtml: true 
                });

                log.debug({
                    title: 'Email Sent',
                    details: `Email sent to ${salesRepId} with subject: ${subject}`
                });
            } catch (e) {
                log.error({
                    title: 'Error Sending Email',
                    details: e.message
                });
            }
        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {

        }

        return { getInputData, map, reduce, summarize }

    });
