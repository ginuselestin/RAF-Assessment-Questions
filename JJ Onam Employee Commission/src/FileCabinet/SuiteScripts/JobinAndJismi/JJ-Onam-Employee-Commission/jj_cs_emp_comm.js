/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/url'],
    /**
     * @param{record} record
     * @param{search} search
     */
    function (record, search, url) {


        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {

            if (scriptContext.fieldId === 'custpage_jj_employee') {
                let employeeId = scriptContext.currentRecord.getValue('custpage_jj_employee');
                if (employeeId) {
                    setSalesAndCommission(scriptContext, employeeId);
                }
            }

        }

        /**
         * Function to set the sales and commission fields based on employee selection.
         *
         * @param {Object} scriptContext - Current context object
         * @param {number} employeeId - The internal ID of the selected employee
         */
        function setSalesAndCommission(scriptContext, employeeId) {
            let transactionTotal = getTotalSalesByEmployee(employeeId);
            let commissionAmount = calculateCommission(transactionTotal);

            scriptContext.currentRecord.setValue({
                fieldId: 'custpage_jj_sales',
                value: transactionTotal
            });

            scriptContext.currentRecord.setValue({
                fieldId: 'custpage_jj_commission',
                value: commissionAmount
            });

            console.log(`Sales set to: ${transactionTotal}, Commission set to: ${commissionAmount}`);
        }

        /**
         * Function to calculate the total sales for a specific employee.
         *
         * @param {number} employeeId - The internal ID of the employee
         * @returns {number} transactionTotal - Total sales of the employee
         */
        function getTotalSalesByEmployee(employeeId) {
            let transactionTotal = 0;

            let transactionSearch = search.create({
                type: "transaction",
                filters: [
                    ["type", "anyof", "CashSale", "CustInvc"],
                    "AND",
                    ["salesrep", "anyof", employeeId],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["trandate", "within", "lastyear"]
                ],
                columns: [
                    search.createColumn({
                        name: "amount",
                        summary: "SUM",
                        label: "Transaction Total"
                    })
                ]
            });

            transactionSearch.run().each(function (result) {
                transactionTotal = parseFloat(result.getValue({
                    name: 'amount',
                    summary: 'SUM'
                })) || 0;

                return true;
            });

            return transactionTotal;
        }

        /**
         * Function to calculate commission based on total sales.
         *
         * @param {number} salesAmount - Total sales amount
         * @returns {number} - Calculated commission (2%)
         */
        function calculateCommission(salesAmount) {
            return salesAmount * 0.02;
        }



        return {
            fieldChanged: fieldChanged,
        };

    });
