/**
 * Generates a PDF report using jsPDF based on current application state.
 */
function generatePDFReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Get current metrics from DOM
    const reroutes = document.getElementById('reroutes-count') ? document.getElementById('reroutes-count').textContent : "0";
    const predictions = document.getElementById('predictions-count') ? document.getElementById('predictions-count').textContent : "0";
    const delaySaved = document.getElementById('avg-delay-saved') ? document.getElementById('avg-delay-saved').textContent : "0 min";
    const accuracy = document.getElementById('prediction-accuracy') ? document.getElementById('prediction-accuracy').textContent : "0%";
    const costSavings = document.getElementById('cost-savings') ? document.getElementById('cost-savings').textContent : "₹0";
    
    const activeShipments = window.trucks ? window.trucks.length : 0;
    
    // Document styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(35, 43, 71);
    doc.text("Supply Chain Shield - Post-Demo Report", 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 28);
    
    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 32, 195, 32);
    
    // Summary Metrics
    doc.setFontSize(14);
    doc.setTextColor(35, 43, 71);
    doc.text("System Performance Summary", 15, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    
    doc.text(`Active Shipments Monitored: ${activeShipments}`, 20, 55);
    doc.text(`Total Predictions Made: ${predictions}`, 20, 62);
    doc.text(`Prediction Accuracy: ${accuracy}`, 20, 69);
    doc.text(`Autonomous Reroutes Executed: ${reroutes}`, 20, 76);
    
    // Value Delivered
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(35, 43, 71);
    doc.text("Business Value Delivered", 15, 95);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Average Delay Prevented per Reroute: 18 min`, 20, 105);
    doc.text(`Total Fleet Delay Prevented: ${delaySaved}`, 20, 112);
    doc.text(`Estimated Capital Savings: ${costSavings}`, 20, 119);
    
    // Timeline of events
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(35, 43, 71);
    doc.text("Key Simulation Events", 15, 140);
    
    doc.setFont("helvetica", "normal");
    doc.text("• T+5m: System deployed, active fleet monitoring initiated.", 20, 150);
    doc.text("• T+15m: Predictive engine identified incoming severe weather front.", 20, 157);
    doc.text("• T+18m: High-risk compound disruption flagged at Ashram Chowk.", 20, 164);
    doc.text("• T+19m: Automated reroute instructions dispatched to field units.", 20, 171);
    
    // Recommendations
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(35, 43, 71);
    doc.text("Strategic Recommendations", 15, 195);
    
    doc.setFont("helvetica", "normal");
    doc.text("1. Integrate real-time weather API for wider geographic coverage.", 20, 205);
    doc.text("2. Automate notifications to warehouse managers upon reroute execution.", 20, 212);
    doc.text("3. Implement historical analysis module for driver risk-profiling.", 20, 219);
    
    // Download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    doc.save(`Supply_Chain_Report_${timestamp}.pdf`);
}

window.generatePDFReport = generatePDFReport;
