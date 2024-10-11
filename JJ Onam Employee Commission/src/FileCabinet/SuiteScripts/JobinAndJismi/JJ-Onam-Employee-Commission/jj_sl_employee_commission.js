/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/*************************************************************************************************
 * 
 * Client Name: NA
 * 
 * Jira Code: RAF Assessment Questions
 * 
 * Title: Employee Commission Calculator and Expense Report Automation for J&J Company
 * 
 * Author: Jobin And Jismi IT Services LLP
 * 
 * Date Created: 11-Oct-2024
 *
 * Description: This Suitelet script allows users to select eligible sales representatives and 
 *              calculates their commission based on total sales generated during the 2023 
 *              financial year, offering the flexibility to modify the calculated value. 
 *              Upon form submission, the script checks for existing employee commission records 
 *              and either updates the commission amount or creates a new record as necessary. 
 *              Additionally, it generates an expense report for each employee, ensuring that only 
 *              one expense report is maintained per employee, while linking this record back to 
 *              the employee commission custom record. 
 * 
 * Revision History: 1.0
 * 
 ************************************************************************************************/

define(['N/record', 'N/redirect', 'N/search', 'N/ui/serverWidget', 'N/url'],
    /**
 * @param{record} record
 * @param{redirect} redirect
 * @param{search} search
 * @param{serverWidget} serverWidget
 * @param{url} url
 */
    (record, redirect, search, serverWidget, url) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            if (scriptContext.request.method === 'GET') {
                let form = createForm();
                form.clientScriptModulePath = 'SuiteScripts/JobinAndJismi/JJ-Onam-Employee-Commission/jj_cs_emp_comm.js'
                scriptContext.response.writePage(form);
            }
            else {
                let employeeId = scriptContext.request.parameters.custpage_jj_employee;
                let salesAmount = parseFloat(scriptContext.request.parameters.custpage_jj_sales);
                let commissionAmount = parseFloat(scriptContext.request.parameters.custpage_jj_commission);

                let commissionRecordId = createOrUpdateEmployeeCommission(employeeId, salesAmount, commissionAmount);
                let expenseReportId = createOrUpdateExpenseReport(employeeId, commissionAmount);

                updateCommissionRecordWithExpenseLink(commissionRecordId, expenseReportId);
                redirect.toSuitelet({
                    scriptId: scriptContext.request.parameters.script,
                    deploymentId: scriptContext.request.parameters.deploy
                });
            }

        }


        /**
         * Function to create and render the form with employee selector and commission calculator.
         * @returns {serverWidget.Form} - Suitelet form object.
         */
        function createForm() {
            let form = serverWidget.createForm({
                title: 'Onam 2024 Employee Commission Calculator'
            });

            let employeeField = form.addField({
                id: 'custpage_jj_employee',
                type: serverWidget.FieldType.SELECT,
                label: 'Select Employee'
            });
            let employeeSearch = search.create({
                type: 'employee',
                filters: [['salesrep', 'is', 'T'], 'AND', ['isinactive', 'is', 'F']],
                columns: ['internalid', 'entityid']
            });

            employeeField.addSelectOption({
                value: ' ',
                text: ' '
            });

            employeeSearch.run().each(function (result) {
                employeeField.addSelectOption({
                    value: result.getValue('internalid'),
                    text: result.getValue('entityid')
                });
                return true;
            });
            form.addField({
                id: 'custpage_jj_sales',
                type: serverWidget.FieldType.CURRENCY,
                label: '2023 Sales Amount'
            });

            var commissionField = form.addField({
                id: 'custpage_jj_commission',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Commission (2%)'
            });

            form.addSubmitButton({ label: 'Submit' });
            return form;
        }

        /**
         * Function to save or update the employee commission record.
         * 
         * @param {number} employeeId - The internal ID of the employee
         * @param {number} salesAmount - The total sales amount for the employee
         * @param {number} commissionAmount - The calculated commission amount
         */
        function createOrUpdateEmployeeCommission(employeeId, salesAmount, commissionAmount) {
            let employeeLookup = search.lookupFields({
                type: 'employee',
                id: employeeId,
                columns: ['entityid']
            });

            let employeeName = employeeLookup.entityid;
            let existingRecordId = getExistingEmployeeCommissionRecord(employeeName);

            if (existingRecordId) {
                record.submitFields({
                    type: 'customrecord_jj_onam_commission_2023',
                    id: existingRecordId,
                    values: {
                        'custrecord_jj_commission_amount': commissionAmount
                    }
                });
                return existingRecordId;
            } else {
                let employeeCommRecord = record.create({
                    type: 'customrecord_jj_onam_commission_2023',
                    isDynamic: true
                });

                employeeCommRecord.setValue({
                    fieldId: 'custrecord_jj_employee_name',
                    value: employeeName
                });

                employeeCommRecord.setValue({
                    fieldId: 'custrecord_jj_2023_sales_amount',
                    value: salesAmount
                });

                employeeCommRecord.setValue({
                    fieldId: 'custrecord_jj_commission_amount',
                    value: commissionAmount
                });

                return employeeCommRecord.save();
            }
        }

        /**
         * Function to check if an employee commission record already exists.
         * 
         * @param {number} employeeId - The internal ID of the employee
         * @returns {number|null} - The internal ID of the existing commission record, or null if none exists
         */
        function getExistingEmployeeCommissionRecord(employeeName) {
            let employeeCommSearch = search.create({
                type: 'customrecord_jj_onam_commission_2023',
                filters: [['custrecord_jj_employee_name', 'is', employeeName]],
                columns: ['internalid']
            });

            let result = employeeCommSearch.run().getRange({ start: 0, end: 1 });

            return result.length > 0 ? result[0].getValue('internalid') : null;
        }


        /**
         * Function to create or update an expense report for the employee.
         * 
         * @param {number} employeeId - The internal ID of the employee
         * @param {number} commissionAmount - The calculated commission amount
         * @returns {number} - The internal ID of the created or updated expense report.
         */
        function createOrUpdateExpenseReport(employeeId, commissionAmount) {
            let existingExpenseReportId = getExistingExpenseReport(employeeId);

            log.debug("expense report id", existingExpenseReportId);

            if (existingExpenseReportId) {
                let expenseReport = record.load({
                    type: 'expensereport',
                    id: existingExpenseReportId,
                    isDynamic: true
                });

                let lineCount = expenseReport.getLineCount({ sublistId: 'expense' });
                log.debug("line count", lineCount);
                for (let i = 0; i < lineCount; i++) {
                    expenseReport.selectLine({
                        sublistId: 'expense',
                        line: i
                    });

                    let category = expenseReport.getCurrentSublistValue({
                        sublistId: 'expense',
                        fieldId: 'category'
                    });
                    log.debug("category", category);

                    if (category == 10) {
                        expenseReport.setCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: 'amount',
                            value: commissionAmount
                        });

                        expenseReport.commitLine({ sublistId: 'expense' });
                        break;
                    }
                }

                return expenseReport.save();
            } else {

                let expenseReport = record.create({
                    type: 'expensereport',
                    isDynamic: true
                });

                expenseReport.setValue({
                    fieldId: 'entity',
                    value: employeeId
                });

                expenseReport.setValue({
                    fieldId: 'account',
                    value: 122
                });


                expenseReport.setValue({
                    fieldId: 'usemulticurrency',
                    value: false
                });


                expenseReport.selectNewLine({ sublistId: 'expense' });


                expenseReport.setCurrentSublistValue({
                    sublistId: 'expense',
                    fieldId: 'category',
                    value: 10
                });

                expenseReport.setCurrentSublistValue({
                    sublistId: 'expense',
                    fieldId: 'amount',
                    value: commissionAmount
                });

                expenseReport.commitLine({ sublistId: 'expense' });
                return expenseReport.save();
            }
        }

        /**
         * Function to update the commission record with a link to the expense report.
         * 
         * @param {number} commissionRecordId - The internal ID of the commission record
         * @param {number} expenseReportId - The internal ID of the expense report
         */
        function updateCommissionRecordWithExpenseLink(commissionRecordId, expenseReportId) {
            let expenseUrl = url.resolveRecord({
                recordType: 'expensereport',
                recordId: expenseReportId
            });

            record.submitFields({
                type: 'customrecord_jj_onam_commission_2023',
                id: commissionRecordId,
                values: {
                    'custrecord_jj_expense_report_link': expenseUrl
                }
            });
        }

        /**
         * Function to check if an expense report already exists for the employee.
         * 
         * @param {number} employeeId - The internal ID of the employee
         * @returns {number|null} - The internal ID of the existing expense report, or null if none exists
         */
        function getExistingExpenseReport(employeeId) {
            let expenseSearch = search.create({
                type: 'expensereport',
                filters: [['entity', 'is', employeeId]],
                columns: ['internalid']
            });

            let result = expenseSearch.run().getRange({ start: 0, end: 1 });

            let expenseReportId = result.length > 0 ? result[0].getValue('internalid') : null;

            log.debug("Expense Report ID:", expenseReportId);

            return expenseReportId;
        }



        return { onRequest };
    });