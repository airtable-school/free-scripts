async function findAndMarkDuplicates() {
    output.markdown('# Find & Mark Duplicates');

    let table = await input.tableAsync('Choose a table');
    let searchField = await input.fieldAsync('Look for duplicates in which field?', table);
    let checkboxField = null;

    // does the table have any checkbox fields to mark the duplicates?
    let checkboxFields = table.fields.filter(field => field.type === "checkbox");

    // if it doesn't, ask the user to create a new checkbox field
    if (checkboxFields.length === 0) {
        output.markdown("#### A checkbox field is required to mark duplicates but none were found in the table.");
        output.markdown("#### What would you like to do next?");
        let next = await input.buttonsAsync("", [
            {
                label: "Cancel",
                value: "cancel"
            },
            {
                label: "Create a new checkbox field",
                value: "createNewField",
                variant: "primary"
            }
        ])

        if (next === "cancel") {
            output.markdown("Canceling...");
            return;
        }

        // ask the user to name the new field and create it.
        let newCheckboxFieldName = await input.textAsync("Name your new checkbox field");
        output.markdown(`#### Creating a new checkbox field called \`${newCheckboxFieldName}\``);

        let newFieldID = await table.createFieldAsync(newCheckboxFieldName, "checkbox", { icon: "check", color: "greenBright"});
        output.markdown("**Done.**");
        checkboxField = table.getField(newFieldID);

    } else {
        let checkboxFieldName = await input.buttonsAsync("Mark duplicates with which checkbox field?", checkboxFields.map(f => f.name));
        checkboxField = table.getField(checkboxFieldName);
    }

    output.markdown("### Searching for duplicates...");

    // get the records from the selected table
    let query = await table.selectRecordsAsync({ fields: [searchField] });

    // keep track of counts and duplicate record ids
    let seen = {};

    for (let record of query.records) {
        let value = record.getCellValueAsString(searchField);

        if (seen[value] === undefined) {
            seen[value] = {};
            seen[value].count = 1;
            seen[value].recordIDs = [record.id];
            continue;
        }

        seen[value].count++;
        seen[value].recordIDs.push(record.id);
    }


    let duplicates = [];

    // if we find duplicates, put them in the array to be updated
    for (let value in seen) {
        if (seen[value].count === 1) {
            continue;
        }

        let recordUpdates = seen[value].recordIDs.map(recordID => (
            {
                id: recordID,
                fields: { 
                    [checkboxField.name]: true
                }
            }
        ));

        duplicates.push(...recordUpdates);
        output.markdown(`**${value}**: ${seen[value].count} occurrences`);
    }

    if (duplicates.length === 0) {
        output.markdown("### No duplicates found. Toodles :-)");
        return;
    }


    output.markdown(`### This script is about to update \`${duplicates.length}\` records with the following changes:`)
    output.inspect(duplicates[0]);

    let shouldContinue = await input.buttonsAsync("Continue?", [
            {label: 'Cancel', value: 'cancel'},
            {label: 'Go for it', value: 'yes', variant: 'primary'},
        ],
    )

    if (shouldContinue === "cancel") {
        output.markdown("Canceling...");
        return;
    }

    output.markdown("Saving records...");
    
    while (duplicates.length > 0) {
        let batch = duplicates.slice(0, 50);
        await table.updateRecordsAsync(batch);
        duplicates = duplicates.slice(50);
    }

    output.markdown("Done.");
}

await findAndMarkDuplicates();
output.markdown("Report bugs, request features, and get more free scripts at https://skool.com/airtable.");
